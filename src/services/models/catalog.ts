export type HfTask =
  | 'text-generation' | 'summarization' | 'text-classification' | 'zero-shot-classification' | 'text2text-generation'
  | 'question-answering' | 'automatic-speech-recognition' | 'audio-classification' | 'image-classification' | 'object-detection';

export interface ModelEntry { id: string; label: string; task: HfTask; category: 'Text' | 'Audio' | 'Image'; note: string }

/** Suggested, Transformers.js-compatible models. NOTHING never downloads these for you: you supply the files. */
export const CATALOG: ModelEntry[] = [
  { id: 'Xenova/distilgpt2', label: 'DistilGPT-2', task: 'text-generation', category: 'Text', note: 'Small English text generator.' },
  { id: 'Xenova/distilbart-cnn-6-6', label: 'DistilBART CNN 6-6', task: 'summarization', category: 'Text', note: 'News-style abstractive summaries.' },
  { id: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', label: 'DistilBERT SST-2', task: 'text-classification', category: 'Text', note: 'Positive / negative sentiment.' },
  { id: 'Xenova/nli-deberta-v3-xsmall', label: 'DeBERTa-v3 xsmall NLI', task: 'zero-shot-classification', category: 'Text', note: 'Classify text into labels you choose.' },
  { id: 'Xenova/LaMini-Flan-T5-77M', label: 'LaMini-Flan-T5 77M', task: 'text2text-generation', category: 'Text', note: 'Instruction-following rewriting.' },
  { id: 'Xenova/distilbert-base-cased-distilled-squad', label: 'DistilBERT SQuAD', task: 'question-answering', category: 'Text', note: 'Extractive question answering.' },
  { id: 'Xenova/whisper-tiny.en', label: 'Whisper tiny (English)', task: 'automatic-speech-recognition', category: 'Audio', note: 'Offline speech-to-text.' },
  { id: 'Xenova/ast-finetuned-audioset-10-10-0.4593', label: 'AST AudioSet', task: 'audio-classification', category: 'Audio', note: 'Classifies sounds (527 AudioSet classes).' },
  { id: 'Xenova/vit-base-patch16-224', label: 'ViT base 224', task: 'image-classification', category: 'Image', note: 'ImageNet-1k classification.' },
  { id: 'Xenova/detr-resnet-50', label: 'DETR ResNet-50', task: 'object-detection', category: 'Image', note: 'COCO object detection with boxes.' },
];

export const byTask = (t: HfTask): ModelEntry[] => CATALOG.filter((m) => m.task === t);

export const REQUIRED_FILES = [
  'config.json', 'tokenizer.json + tokenizer_config.json (text / audio models)', 'preprocessor_config.json (image / audio models)',
  'generation_config.json (generative models)', 'onnx/model_quantized.onnx (WASM) — and/or onnx/model.onnx (WebGPU)',
  'Encoder-decoder models (T5, BART, Whisper) need onnx/encoder_model*.onnx and onnx/decoder_model_merged*.onnx',
];
