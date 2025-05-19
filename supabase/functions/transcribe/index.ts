
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath, fileName, fileSize } = await req.json();
    
    if (!filePath || !fileName) {
      throw new Error('File path and name are required');
    }
    
    // Create a Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Create a transcription record
    const { data: transcription, error: insertError } = await supabase
      .from('transcriptions')
      .insert({
        file_name: fileName,
        file_path: filePath,
        file_size: fileSize,
        status: 'processing'
      })
      .select()
      .single();
      
    if (insertError) {
      throw new Error(`Failed to create transcription record: ${insertError.message}`);
    }
    
    // Download the file from Supabase storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('audio_files')
      .download(filePath);
      
    if (downloadError || !fileData) {
      await updateTranscriptionStatus(supabase, transcription.id, 'failed', null, `Failed to download file: ${downloadError?.message}`);
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }
    
    // Send to OpenAI Whisper API
    const formData = new FormData();
    formData.append('file', fileData, fileName);
    formData.append('model', 'whisper-1');
    
    const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: formData,
    });
    
    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      await updateTranscriptionStatus(supabase, transcription.id, 'failed', null, `OpenAI API error: ${errorData}`);
      throw new Error(`OpenAI API error: ${errorData}`);
    }
    
    const result = await openaiResponse.json();
    
    // Update transcription with result
    await updateTranscriptionStatus(supabase, transcription.id, 'completed', result.text);
    
    return new Response(
      JSON.stringify({ 
        id: transcription.id,
        transcript: result.text 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Transcription error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to update transcription status
async function updateTranscriptionStatus(
  supabase: any,
  id: string,
  status: string,
  transcript: string | null = null,
  error: string | null = null
) {
  const updateData: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };
  
  if (transcript !== null) {
    updateData.transcript = transcript;
  }
  
  if (error !== null) {
    updateData.error = error;
  }
  
  const { error: updateError } = await supabase
    .from('transcriptions')
    .update(updateData)
    .eq('id', id);
    
  if (updateError) {
    console.error('Failed to update transcription status:', updateError);
  }
}
