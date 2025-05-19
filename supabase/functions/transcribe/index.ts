
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OpenAI Whisper API size limit (25MB in bytes)
const MAX_FILE_SIZE = 25 * 1024 * 1024;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath, fileName, fileSize, customTitle } = await req.json();
    
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
        status: 'processing',
        custom_title: customTitle || fileName.split('.')[0] // Store the custom title
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
    
    // Process file based on size
    let transcript = '';
    
    if (fileData.size <= MAX_FILE_SIZE) {
      // Process small file normally
      transcript = await processAudioChunk(fileData, fileName);
    } else {
      // Large file needs chunking
      transcript = await processLargeFile(fileData, fileName);
    }
    
    // Update transcription with result
    await updateTranscriptionStatus(supabase, transcription.id, 'completed', transcript);
    
    return new Response(
      JSON.stringify({ 
        id: transcription.id,
        transcript: transcript 
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

// Process a single audio chunk with Whisper API
async function processAudioChunk(audioData: Blob, fileName: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioData, fileName);
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
    throw new Error(`OpenAI API error: ${errorData}`);
  }
  
  const result = await openaiResponse.json();
  return result.text;
}

// Process large audio file by splitting into chunks
async function processLargeFile(fileData: Blob, fileName: string): Promise<string> {
  console.log(`Processing large file: ${fileName}, size: ${fileData.size} bytes`);
  
  // Convert blob to array buffer for processing
  const arrayBuffer = await fileData.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Calculate number of chunks needed
  const chunkSize = MAX_FILE_SIZE - 1024 * 1024; // Leave 1MB buffer
  const numChunks = Math.ceil(fileData.size / chunkSize);
  console.log(`Splitting into ${numChunks} chunks of ~${chunkSize / (1024 * 1024)}MB each`);
  
  const transcriptions: string[] = [];
  
  // Process each chunk
  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min((i + 1) * chunkSize, fileData.size);
    
    console.log(`Processing chunk ${i + 1}/${numChunks}, bytes ${start}-${end}`);
    
    // Get chunk data
    const chunkData = uint8Array.slice(start, end);
    const chunkBlob = new Blob([chunkData], { type: fileData.type });
    
    try {
      // Process this chunk
      const chunkFileName = `${fileName.split('.')[0]}_chunk${i + 1}.${fileName.split('.').pop()}`;
      const chunkTranscription = await processAudioChunk(chunkBlob, chunkFileName);
      
      transcriptions.push(chunkTranscription);
      console.log(`Chunk ${i + 1} transcription complete`);
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error);
      // Continue with other chunks even if one fails
    }
  }
  
  // Combine all transcriptions
  return transcriptions.join(' ');
}

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
