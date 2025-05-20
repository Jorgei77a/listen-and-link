
// Import necessary modules
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Constants for CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Required OpenAI API key
const openAiKey = Deno.env.get('OPENAI_API_KEY');

// Create Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Configure the service
serve(async (req) => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Security check: If no OpenAI key, return error
    if (!openAiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Security check: If no admin key, return error
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the request body
    const payload = await req.json();
    const { filePath, fileName, fileSize, customTitle, estimatedDuration } = payload;

    // Validate required fields
    if (!filePath || !fileName || !fileSize) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Make sure estimatedDuration is rounded to an integer if provided
    const roundedDuration = estimatedDuration ? Math.round(Number(estimatedDuration)) : null;

    // Create a transcription record in the database
    const { data: transcription, error: transcriptionError } = await supabase
      .from('transcriptions')
      .insert({
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
        custom_title: customTitle || fileName.split('.')[0],
        status: 'processing',
        progress_message: 'Starting transcription...',
        // Store rounded estimated duration until we get the real one
        audio_duration: roundedDuration
      })
      .select()
      .single();

    if (transcriptionError) {
      console.error('Error creating transcription record:', transcriptionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create transcription record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Start the transcription process in the background
    const transcriptionId = transcription.id;
    
    // This will not block the response, it's a background task
    EdgeRuntime.waitUntil(processTranscription(
      transcriptionId, 
      filePath, 
      supabase, 
      openAiKey
    ));

    // Return the transcription ID immediately
    return new Response(
      JSON.stringify({ 
        id: transcriptionId,
        message: 'Transcription job started', 
        status: 'processing' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Process a transcription in the background
 */
async function processTranscription(
  transcriptionId: string, 
  filePath: string, 
  supabase: any, 
  openAiKey: string
) {
  try {
    // Update record to show we're starting to process
    await supabase
      .from('transcriptions')
      .update({ 
        progress_message: 'Downloading audio file...',
        updated_at: new Date().toISOString()
      })
      .eq('id', transcriptionId);

    // Download the audio file from storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('audio_files')
      .download(filePath);

    if (fileError) {
      throw new Error(`Failed to download audio file: ${fileError.message}`);
    }

    // Update progress
    await supabase
      .from('transcriptions')
      .update({ 
        progress_message: 'Preparing audio for transcription...',
        updated_at: new Date().toISOString()
      })
      .eq('id', transcriptionId);

    // Create form data for the OpenAI API request
    const formData = new FormData();
    formData.append('file', fileData);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');

    // Update progress
    await supabase
      .from('transcriptions')
      .update({ 
        progress_message: 'Sending to OpenAI for transcription...',
        updated_at: new Date().toISOString()
      })
      .eq('id', transcriptionId);

    // Call the OpenAI API to transcribe the audio
    const openAiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
      },
      body: formData,
    });

    // If the OpenAI API returns an error
    if (!openAiResponse.ok) {
      const errorData = await openAiResponse.text();
      throw new Error(`OpenAI API error: ${errorData}`);
    }

    // Parse the OpenAI API response
    const openAiData = await openAiResponse.json();
    const transcript = openAiData.text;

    // Some transcription services return metadata like duration
    // If OpenAI Whisper returns duration (it currently doesn't directly), we can use it
    // For now we'll calculate it from segments or use other means
    let audioDuration = null;
    
    // If OpenAI returns audio segments with timestamps, we can estimate duration
    if (openAiData.segments && openAiData.segments.length > 0) {
      const lastSegment = openAiData.segments[openAiData.segments.length - 1];
      audioDuration = Math.ceil(lastSegment.end);
    } else if (openAiData.duration) {
      // If OpenAI someday directly returns duration
      audioDuration = Math.ceil(openAiData.duration);
    }
    
    // Make sure audio_duration is always an integer
    const roundedDuration = audioDuration ? Math.round(Number(audioDuration)) : null;
    
    // Update the transcription record with the transcript text, status, and actual duration if available
    await supabase
      .from('transcriptions')
      .update({ 
        transcript: transcript,
        status: 'completed',
        audio_duration: roundedDuration, // Use rounded duration
        updated_at: new Date().toISOString()
      })
      .eq('id', transcriptionId);

    console.log(`Transcription ${transcriptionId} completed successfully.`);

  } catch (error) {
    console.error(`Transcription ${transcriptionId} failed:`, error);
    
    // Update the transcription record with the error
    await supabase
      .from('transcriptions')
      .update({ 
        status: 'failed',
        error: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', transcriptionId);
  }
}
