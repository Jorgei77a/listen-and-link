
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OpenAI Whisper API size limit (25MB in bytes)
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// Supported audio formats by Whisper API
const SUPPORTED_FORMATS = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'];

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
    
    // Verify file format is supported
    const fileExt = fileName.split('.').pop()?.toLowerCase();
    if (!fileExt || !SUPPORTED_FORMATS.includes(fileExt)) {
      throw new Error(`Unsupported file format: ${fileExt}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`);
    }
    
    // Create a transcription record
    const { data: transcription, error: insertError } = await supabase
      .from('transcriptions')
      .insert({
        file_name: fileName,
        file_path: filePath,
        file_size: fileSize,
        status: 'processing',
        custom_title: customTitle || fileName.split('.')[0]
      })
      .select()
      .single();
      
    if (insertError) {
      throw new Error(`Failed to create transcription record: ${insertError.message}`);
    }

    // Start background processing
    const transcriptionId = transcription.id;
    
    // Use Deno's backgroundFetch for async processing
    if (typeof EdgeRuntime !== 'undefined') {
      console.log('Starting background processing for transcription:', transcriptionId);
      
      // Start background processing task
      EdgeRuntime.waitUntil(
        (async () => {
          try {
            await processTranscription(supabase, transcriptionId, filePath, fileName, fileSize);
            console.log('Background processing completed successfully for:', transcriptionId);
          } catch (error) {
            console.error('Background processing failed:', error);
            await updateTranscriptionStatus(
              supabase,
              transcriptionId,
              'failed',
              null,
              `Processing error: ${error.message}`
            );
          }
        })()
      );
    } else {
      // Fallback for environments without EdgeRuntime
      setTimeout(() => {
        processTranscription(supabase, transcriptionId, filePath, fileName, fileSize)
          .catch(error => {
            console.error('Processing error:', error);
            updateTranscriptionStatus(
              supabase,
              transcriptionId,
              'failed',
              null,
              `Processing error: ${error.message}`
            );
          });
      }, 0);
    }
    
    // Return immediate response
    return new Response(
      JSON.stringify({ 
        id: transcriptionId,
        message: 'Transcription processing started in background'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Initial request error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Main processing function that runs in the background
async function processTranscription(
  supabase: any,
  transcriptionId: string,
  filePath: string,
  fileName: string,
  fileSize: number
): Promise<void> {
  try {
    console.log(`Starting transcription processing for ${fileName} (${fileSize} bytes)`);
    
    // Download the file from Supabase storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('audio_files')
      .download(filePath);
      
    if (downloadError || !fileData) {
      await updateTranscriptionStatus(
        supabase, 
        transcriptionId, 
        'failed', 
        null, 
        `Failed to download file: ${downloadError?.message}`
      );
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }
    
    // Update status to show download complete
    await updateTranscriptionProgress(
      supabase,
      transcriptionId,
      'processing',
      'File downloaded, starting transcription'
    );
    
    // Process file based on size
    let transcript = '';
    
    if (fileData.size <= MAX_FILE_SIZE) {
      // Process small file normally
      transcript = await processAudioChunk(fileData, fileName);
      
      // Update status to show transcription is done
      await updateTranscriptionProgress(
        supabase,
        transcriptionId,
        'processing',
        'Transcription complete, finalizing'
      );
    } else {
      // Large file needs intelligent chunking
      transcript = await processLargeFile(supabase, transcriptionId, fileData, fileName);
    }
    
    // Update transcription with result
    await updateTranscriptionStatus(supabase, transcriptionId, 'completed', transcript);
    
    console.log(`Transcription completed successfully for ${fileName}`);
    
  } catch (error) {
    console.error(`Transcription processing error for ${fileName}:`, error);
    await updateTranscriptionStatus(
      supabase, 
      transcriptionId, 
      'failed', 
      null, 
      `Processing error: ${error.message}`
    );
    throw error;
  }
}

// Process a single audio chunk with Whisper API
async function processAudioChunk(audioData: Blob, fileName: string): Promise<string> {
  console.log(`Processing audio chunk: ${fileName}, size: ${audioData.size} bytes`);
  
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
    console.error(`OpenAI API error for ${fileName}:`, errorData);
    throw new Error(`OpenAI API error: ${errorData}`);
  }
  
  const result = await openaiResponse.json();
  return result.text;
}

// Process large audio file by format-aware chunking
async function processLargeFile(
  supabase: any, 
  transcriptionId: string,
  fileData: Blob, 
  fileName: string
): Promise<string> {
  console.log(`Processing large file: ${fileName}, size: ${fileData.size} bytes`);
  
  const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
  
  // For m4a files and other formats, we need to use time-based chunking
  // But since we can't easily do that in this environment, we'll use a specialized approach
  
  // For now, we'll use a more intelligent byte-based chunking that preserves file headers
  
  // Calculate optimal chunk size based on file type
  // Leave extra headroom for headers to ensure valid audio fragments
  const chunkSize = MAX_FILE_SIZE - 2 * 1024 * 1024; // 2MB safety buffer
  
  // Get total file as array buffer for processing
  const arrayBuffer = await fileData.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);
  
  // Estimate total chunks
  const estimatedChunks = Math.ceil(fileData.size / chunkSize);
  console.log(`Estimated ${estimatedChunks} chunks needed for processing`);
  
  // Update status to show chunking started
  await updateTranscriptionProgress(
    supabase,
    transcriptionId,
    'processing',
    `Splitting file into ${estimatedChunks} segments for processing`
  );
  
  // For audio formats that need header preservation, we create temporary files with headers

  // For m4a and formats where splitting is problematic, use header-aware chunking
  if (['m4a', 'mp4'].includes(fileExt)) {
    return await processAudioWithHeaders(supabase, transcriptionId, fileBytes, fileExt, fileName, chunkSize);
  } else {
    // For other formats, use regular chunking with small overlaps
    return await processRegularChunks(supabase, transcriptionId, fileBytes, fileExt, fileName, chunkSize);
  }
}

// Process audio that requires header preservation
async function processAudioWithHeaders(
  supabase: any,
  transcriptionId: string,
  fileBytes: Uint8Array,
  fileExt: string,
  fileName: string,
  chunkSize: number
): Promise<string> {
  // For m4a/mp4 files, we'll try to create segments with synthetic headers
  // This is a simplified approach - production code would need a proper audio processing library
  
  // Identify important header portions (first 1MB)
  const headerSize = 1024 * 1024; // 1MB for header
  const headerData = fileBytes.slice(0, headerSize);
  
  // Calculate chunks
  const contentSize = fileBytes.length - headerSize;
  const contentChunkSize = chunkSize - headerSize;
  const numChunks = Math.ceil(contentSize / contentChunkSize);
  
  console.log(`Processing ${fileExt} file with header preservation. Creating ${numChunks} segments.`);
  
  const transcriptions: string[] = [];
  let processedChunks = 0;
  
  // Process each content chunk with header prepended
  for (let i = 0; i < numChunks; i++) {
    // Update progress
    await updateTranscriptionProgress(
      supabase,
      transcriptionId,
      'processing',
      `Processing segment ${i+1} of ${numChunks}`
    );
    
    const contentStart = headerSize + (i * contentChunkSize);
    const contentEnd = Math.min(contentStart + contentChunkSize, fileBytes.length);
    
    // Create a chunk with header + content segment
    const contentSegment = fileBytes.slice(contentStart, contentEnd);
    
    // Create combined chunk with header
    const combinedChunk = new Uint8Array(headerData.length + contentSegment.length);
    combinedChunk.set(headerData, 0);
    combinedChunk.set(contentSegment, headerData.length);
    
    const chunkBlob = new Blob([combinedChunk], { type: `audio/${fileExt}` });
    const chunkName = `${fileName.split('.')[0]}_chunk${i+1}.${fileExt}`;
    
    try {
      const chunkTranscription = await processAudioChunk(chunkBlob, chunkName);
      transcriptions.push(chunkTranscription);
      processedChunks++;
      
      console.log(`Completed segment ${i+1}/${numChunks}`);
    } catch (error) {
      console.error(`Error processing segment ${i+1}/${numChunks}:`, error);
      // Continue with other chunks even if one fails
    }
  }
  
  console.log(`Processed ${processedChunks}/${numChunks} segments successfully`);
  
  // Combine all transcriptions
  return transcriptions.join(' ');
}

// Process audio with regular chunking + small overlaps
async function processRegularChunks(
  supabase: any,
  transcriptionId: string,
  fileBytes: Uint8Array,
  fileExt: string,
  fileName: string,
  chunkSize: number
): Promise<string> {
  // Add small overlaps between chunks to ensure no content is lost
  const overlap = 1024 * 512; // 512KB overlap
  const effectiveChunkSize = chunkSize - overlap;
  
  // Calculate number of chunks needed
  const numChunks = Math.ceil(fileBytes.length / effectiveChunkSize);
  console.log(`Processing with ${numChunks} overlapping chunks`);
  
  const transcriptions: string[] = [];
  let processedChunks = 0;
  
  // Process each chunk
  for (let i = 0; i < numChunks; i++) {
    // Update progress
    await updateTranscriptionProgress(
      supabase,
      transcriptionId,
      'processing',
      `Processing segment ${i+1} of ${numChunks}`
    );
    
    const start = i * effectiveChunkSize;
    const end = Math.min(start + chunkSize, fileBytes.length);
    
    console.log(`Processing chunk ${i+1}/${numChunks}, bytes ${start}-${end}`);
    
    // Get chunk data with overlap
    const chunkData = fileBytes.slice(start, end);
    const chunkBlob = new Blob([chunkData], { type: `audio/${fileExt}` });
    const chunkName = `${fileName.split('.')[0]}_chunk${i+1}.${fileExt}`;
    
    try {
      // Process this chunk
      const chunkTranscription = await processAudioChunk(chunkBlob, chunkName);
      
      transcriptions.push(chunkTranscription);
      processedChunks++;
      
      console.log(`Chunk ${i+1} transcription complete`);
    } catch (error) {
      console.error(`Error processing chunk ${i+1}:`, error);
      // Continue with other chunks even if one fails
    }
  }
  
  console.log(`Processed ${processedChunks}/${numChunks} chunks successfully`);
  
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

// Helper function to update transcription progress
async function updateTranscriptionProgress(
  supabase: any,
  id: string,
  status: string,
  progress_message: string
) {
  const { error: updateError } = await supabase
    .from('transcriptions')
    .update({
      status,
      progress_message,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);
    
  if (updateError) {
    console.error('Failed to update transcription progress:', updateError);
  }
}
