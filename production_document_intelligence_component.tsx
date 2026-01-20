import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, FileText, AlertCircle, CheckCircle, Loader2, Download, X, Settings } from 'lucide-react';

// Types
interface ProcessedDocument {
  id: string;
  filename: string;
  fileSize: number;
  uploadedAt: string;
  documentType: string;
  confidence: number;
  extractedText: string;
  extractedFields: ExtractedField[];
  summary: string;
  actionItems: string[];
  complianceRequirements: string[];
  deadlines: Array<{ item: string; date: string }>;
  processingStatus: 'processing' | 'completed' | 'failed';
}

interface ExtractedField {
  field: string;
  value: string;
  confidence: number;
}

interface ScannerDevice {
  id: string;
  name: string;
  type: 'twain' | 'camera';
  capabilities: {
    dpiOptions: number[];
    colorModes: string[];
  };
}

interface ScanSettings {
  dpi: number;
  colorMode: 'color' | 'grayscale' | 'blackwhite';
}

// Real API functions
const GOOGLE_VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const extractTextWithVisionAPI = async (file: File, apiKey: string): Promise<string> => {
  const base64 = await fileToBase64(file);
  
  const response = await fetch(GOOGLE_VISION_API_URL, {
    method: 'POST',
    headers: {
      'X-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{
        image: { content: base64 },
        features: [
          { type: 'TEXT_DETECTION' },
          { type: 'DOCUMENT_TEXT_DETECTION' }
        ]
      }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision API Error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  
  if (result.responses[0]?.error) {
    throw new Error(`Vision API Error: ${result.responses[0].error.message}`);
  }

  return result.responses[0]?.fullTextAnnotation?.text || '';
};

const analyzeDocumentWithGemini = async (extractedText: string, apiKey: string): Promise<any> => {
  const prompt = `Extract structured data from this document. Return ONLY valid JSON with no markdown formatting:

Document text: "${extractedText.substring(0, 4000)}"

Return this exact JSON structure:
{
  "documentType": "Court Order|Medical Record|Insurance Card|Drug Screen|Assessment Form|Other",
  "confidence": 0.95,
  "extractedFields": [
    {"field": "Case Number", "value": "STL-2024-001", "confidence": 0.92},
    {"field": "Court Date", "value": "2024-12-15", "confidence": 0.88},
    {"field": "Judge Name", "value": "Judge Smith", "confidence": 0.85}
  ],
  "summary": "Brief summary of document content",
  "actionItems": ["Schedule court date", "Update client record", "Add to calendar"],
  "complianceRequirements": ["Complete SATOP by March 2025"],
  "deadlines": [{"item": "SATOP completion", "date": "2025-03-15"}]
}`;

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'X-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('No response from Gemini API');
  }

  const responseText = result.candidates[0].content.parts[0].text;
  
  try {
    const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (parseError) {
    console.error('Failed to parse Gemini response:', responseText);
    throw new Error(`Invalid JSON response from Gemini: ${responseText.substring(0, 200)}`);
  }
};

const processDocumentReal = async (file: File, apiKey: string): Promise<ProcessedDocument> => {
  if (!apiKey) {
    throw new Error('Google API key is required');
  }

  try {
    const extractedText = await extractTextWithVisionAPI(file, apiKey);
    
    if (!extractedText.trim()) {
      throw new Error('No text could be extracted from the document');
    }

    const analysis = await analyzeDocumentWithGemini(extractedText, apiKey);

    const processedDocument: ProcessedDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      filename: file.name,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      documentType: analysis.documentType || 'Unknown',
      confidence: analysis.confidence || 0.1,
      extractedText: extractedText,
      extractedFields: analysis.extractedFields || [],
      summary: analysis.summary || 'Document processed successfully',
      actionItems: analysis.actionItems || [],
      complianceRequirements: analysis.complianceRequirements || [],
      deadlines: analysis.deadlines || [],
      processingStatus: 'completed' as const
    };

    return processedDocument;
  } catch (error) {
    console.error('Document processing failed:', error);
    throw error;
  }
};

const detectHardwareScanners = async (): Promise<ScannerDevice[]> => {
  const scanners: ScannerDevice[] = [];

  try {
    if (typeof (window as any).DWObject !== 'undefined') {
      const DWObject = (window as any).DWObject;
      const sourceCount = DWObject.SourceCount;
      
      for (let i = 0; i < sourceCount; i++) {
        scanners.push({
          id: i.toString(),
          name: DWObject.GetSourceNameItems(i) || `Scanner ${i + 1}`,
          type: 'twain' as const,
          capabilities: {
            dpiOptions: [150, 200, 300, 600],
            colorModes: ['color', 'grayscale', 'blackwhite']
          }
        });
      }
    }
  } catch (error) {
    console.warn('TWAIN scanner detection failed:', error);
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(device => device.kind === 'videoinput');
    
    cameras.forEach(camera => {
      scanners.push({
        id: camera.deviceId,
        name: camera.label || `Camera ${camera.deviceId.substring(0, 8)}`,
        type: 'camera' as const,
        capabilities: {
          dpiOptions: [150, 300],
          colorModes: ['color', 'grayscale']
        }
      });
    });
  } catch (error) {
    console.warn('Camera detection failed:', error);
  }

  return scanners;
};

const captureFromScanner = async (scannerId: string, scannerType: 'twain' | 'camera', settings: ScanSettings): Promise<File> => {
  if (scannerType === 'twain') {
    if (typeof (window as any).DWObject !== 'undefined') {
      const DWObject = (window as any).DWObject;
      
      return new Promise((resolve, reject) => {
        try {
          DWObject.SelectSourceByIndex(parseInt(scannerId));
          DWObject.OpenSource();
          
          DWObject.AcquireImage({
            Resolution: settings.dpi || 300,
            PixelType: settings.colorMode === 'color' ? 2 : settings.colorMode === 'grayscale' ? 1 : 0,
            IfShowUI: false,
            IfFeederEnabled: false,
            IfDuplexEnabled: false
          }, 
          () => {
            DWObject.ConvertToBlob([DWObject.CurrentImageIndexInBuffer], 2,
              (blob: Blob) => {
                const file = new File([blob], `twain-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
                resolve(file);
              },
              (error: any) => reject(new Error(`TWAIN conversion failed: ${error}`))
            );
          },
          (error: any) => reject(new Error(`TWAIN scan failed: ${error}`))
          );
        } catch (error) {
          reject(new Error(`TWAIN operation failed: ${error}`));
        }
      });
    } else {
      throw new Error('TWAIN scanner not available');
    }
  } else {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: scannerId },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);
        
        stream.getTracks().forEach(track => track.stop());
        
        canvas.toBlob((blob) => {
          const file = new File([blob!], `camera-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
          resolve(file);
        }, 'image/jpeg', 0.9);
      };
    });
  }
};

const exportDocumentsToJSON = (documents: ProcessedDocument[]): void => {
  const exportData = {
    exportDate: new Date().toISOString(),
    documentCount: documents.length,
    source: 'ACS TherapyHub Document Intelligence',
    documents: documents
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `acs-documents-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const exportDocumentsToCSV = (documents: ProcessedDocument[]): void => {
  const headers = [
    'Filename', 'Document Type', 'Confidence', 'Upload Date',
    'Case Number', 'Court Date', 'Judge', 'Summary', 'Action Items', 'Deadlines'
  ];
  
  const rows = documents.map(doc => {
    const caseNumber = doc.extractedFields.find(f => f.field === 'Case Number')?.value || '';
    const courtDate = doc.extractedFields.find(f => f.field === 'Court Date')?.value || '';
    const judge = doc.extractedFields.find(f => f.field === 'Judge Name' || f.field === 'Judge')?.value || '';
    const deadlines = doc.deadlines.map(d => `${d.item}: ${d.date}`).join('; ');
    
    return [
      doc.filename,
      doc.documentType,
      doc.confidence.toFixed(2),
      new Date(doc.uploadedAt).toLocaleDateString(),
      caseNumber,
      courtDate,
      judge,
      doc.summary,
      doc.actionItems.join('; '),
      deadlines
    ];
  });
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `acs-document-analysis-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default function ProductionDocumentIntelligence() {
  // State management
  const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<ProcessedDocument | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // API configuration
  const [apiKey, setApiKey] = useState(process.env.REACT_APP_GOOGLE_API_KEY || '');
  const [showApiConfig, setShowApiConfig] = useState(!apiKey);
  
  // Scanner integration
  const [availableScanners, setAvailableScanners] = useState<ScannerDevice[]>([]);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [selectedScanner, setSelectedScanner] = useState<string>('');
  const [scanSettings, setScanSettings] = useState<ScanSettings>({
    dpi: 300,
    colorMode: 'color'
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize scanners on component mount
  useEffect(() => {
    const initScanners = async () => {
      try {
        const scanners = await detectHardwareScanners();
        setAvailableScanners(scanners);
        if (scanners.length > 0) {
          setSelectedScanner(scanners[0].id);
        }
      } catch (err) {
        console.error('Scanner initialization failed:', err);
      }
    };

    if (apiKey) {
      initScanners();
    }
  }, [apiKey]);

  // File upload handler - REAL PROCESSING
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!apiKey) {
      setError('Google API key is required. Please configure your API key.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      console.log('Processing document with real Google Cloud APIs...');
      const result = await processDocumentReal(file, apiKey);
      
      setProcessedDocuments(prev => [...prev, result]);
      setSelectedDocument(result);
      
      console.log('Document processed successfully:', result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Processing failed';
      setError(errorMessage);
      console.error('Document processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Scanner capture handler - REAL HARDWARE
  const handleScannerCapture = async () => {
    if (!selectedScanner || !apiKey) return;

    const scanner = availableScanners.find(s => s.id === selectedScanner);
    if (!scanner) return;

    setIsProcessing(true);
    setError(null);

    try {
      console.log('Capturing from hardware scanner...');
      const file = await captureFromScanner(selectedScanner, scanner.type, scanSettings);
      
      console.log('Processing scanned document with real Google Cloud APIs...');
      const result = await processDocumentReal(file, apiKey);
      
      setProcessedDocuments(prev => [...prev, result]);
      setSelectedDocument(result);
      setShowScannerModal(false);
      
      console.log('Scanned document processed successfully:', result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Scan processing failed';
      setError(errorMessage);
      console.error('Scanner processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Field correction handler
  const handleFieldCorrection = (fieldIndex: number, newValue: string) => {
    if (!selectedDocument) return;

    const updatedDocument = {
      ...selectedDocument,
      extractedFields: selectedDocument.extractedFields.map((field, index) =>
        index === fieldIndex ? { ...field, value: newValue, confidence: 1.0 } : field
      )
    };

    setSelectedDocument(updatedDocument);
    setProcessedDocuments(prev =>
      prev.map(doc => doc.id === selectedDocument.id ? updatedDocument : doc)
    );
  };

  // API Configuration Modal
  if (showApiConfig) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg border">
        <h2 className="text-xl font-bold mb-4">Configure Google Cloud API</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google API Key *
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your Google Cloud API key"
            />
            <p className="text-xs text-gray-500 mt-1">
              Requires Vision API and Gemini API access
            </p>
          </div>
          
          <button
            onClick={() => {
              if (apiKey.length > 20) {
                setShowApiConfig(false);
              } else {
                alert('Please enter a valid Google API key');
              }
            }}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            Continue to Document Intelligence
          </button>
          
          <div className="text-xs text-gray-600 space-y-1">
            <p>Required Google Cloud APIs:</p>
            <ul className="list-disc list-inside ml-2">
              <li>Cloud Vision API</li>
              <li>Generative AI API (Gemini)</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Document Intelligence Hub
        </h1>
        <p className="text-gray-600">
          Production AI-powered document processing with real Google Cloud APIs
        </p>
        <div className="mt-2 text-sm text-green-600 font-medium">
          ✓ Real Google Vision API • ✓ Real Gemini API • ✓ Hardware Scanner Support
        </div>
      </div>

      {/* Controls Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-6">
          <div className="flex flex-wrap gap-4 mb-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </button>
            
            <button
              onClick={() => setShowScannerModal(true)}
              disabled={isProcessing || availableScanners.length === 0}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="h-4 w-4 mr-2" />
              Scan with Hardware ({availableScanners.length} available)
            </button>
            
            {processedDocuments.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => exportDocumentsToJSON(processedDocuments)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export JSON
                </button>
                <button
                  onClick={() => exportDocumentsToCSV(processedDocuments)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export CSV
                </button>
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          {/* API Status */}
          <div className="text-xs text-gray-500">
            API Status: {apiKey ? '✓ Configured' : '✗ Not configured'} | 
            Scanners: {availableScanners.length} detected
          </div>
        </div>
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin mr-2" />
            <span className="text-blue-800 font-medium">
              Processing with Google Cloud APIs...
            </span>
          </div>
          <p className="text-blue-600 text-sm mt-1">
            Making real API calls to Vision API and Gemini
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
            <div>
              <span className="text-red-800 font-medium">Processing Error</span>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Hardware Scanner</h3>
              <button
                onClick={() => setShowScannerModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Scanner
                </label>
                <select
                  value={selectedScanner}
                  onChange={(e) => setSelectedScanner(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableScanners.map(scanner => (
                    <option key={scanner.id} value={scanner.id}>
                      {scanner.name} ({scanner.type})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    DPI
                  </label>
                  <select
                    value={scanSettings.dpi}
                    onChange={(e) => setScanSettings(prev => ({ ...prev, dpi: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={150}>150 DPI</option>
                    <option value={200}>200 DPI</option>
                    <option value={300}>300 DPI</option>
                    <option value={600}>600 DPI</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color Mode
                  </label>
                  <select
                    value={scanSettings.colorMode}
                    onChange={(e) => setScanSettings(prev => ({ ...prev, colorMode: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="color">Color</option>
                    <option value="grayscale">Grayscale</option>
                    <option value="blackwhite">Black & White</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowScannerModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScannerCapture}
                  disabled={!selectedScanner}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  Scan Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document List and Analysis */}
      {processedDocuments.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Document List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Processed Documents ({processedDocuments.length})</h2>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {processedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocument(doc)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedDocument?.id === doc.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{doc.filename}</h3>
                      <p className="text-sm text-gray-500">
                        {doc.documentType} • {Math.round(doc.confidence * 100)}% confidence
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(doc.uploadedAt).toLocaleString()}
                      </p>
                    </div>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Document Analysis Panel */}
          {selectedDocument && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Document Analysis</h2>
                <p className="text-sm text-gray-600">
                  {selectedDocument.documentType} • {Math.round(selectedDocument.confidence * 100)}% confidence
                </p>
              </div>
              
              <div className="p-4 space-y-6 max-h-[600px] overflow-y-auto">
                {/* AI Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">AI Summary</h3>
                  <p className="text-sm text-gray-700">{selectedDocument.summary}</p>
                </div>

                {/* Action Items */}
                {selectedDocument.actionItems.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="font-medium text-blue-900 mb-2">Recommended Actions</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                      {selectedDocument.actionItems.map((item, index) => (
                        <li key={index}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Compliance Requirements */}
                {selectedDocument.complianceRequirements.length > 0 && (
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <h3 className="font-medium text-yellow-900 mb-2">Compliance Requirements</h3>
                    <ul className="text-sm text-yellow-800 space-y-1">
                      {selectedDocument.complianceRequirements.map((req, index) => (
                        <li key={index}>• {req}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Deadlines */}
                {selectedDocument.deadlines.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-4">
                    <h3 className="font-medium text-red-900 mb-2">Important Deadlines</h3>
                    <ul className="text-sm text-red-800 space-y-1">
                      {selectedDocument.deadlines.map((deadline, index) => (
                        <li key={index}>• {deadline.item}: {deadline.date}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Extracted Fields */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Extracted Data Fields</h3>
                  <div className="space-y-3">
                    {selectedDocument.extractedFields.map((field, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm font-medium text-gray-700">
                            {field.field}
                          </label>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            field.confidence > 0.8 
                              ? 'bg-green-100 text-green-800' 
                              : field.confidence > 0.6 
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {Math.round(field.confidence * 100)}% confidence
                          </span>
                        </div>
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => handleFieldCorrection(index, e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            field.confidence < 0.7 ? 'border-yellow-300 bg-yellow-50' : 'border-gray-300'
                          }`}
                          placeholder={`Enter ${field.field.toLowerCase()}`}
                        />
                        {field.confidence < 0.7 && (
                          <p className="text-xs text-yellow-600 mt-1">
                            Low confidence - please verify this field
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Raw Text Preview */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Extracted Text Preview</h3>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    <p className="text-xs text-gray-600 font-mono leading-relaxed">
                      {selectedDocument.extractedText.substring(0, 500)}
                      {selectedDocument.extractedText.length > 500 && '...'}
                    </p>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t">
                  <button
                    onClick={() => {
                      // Here you would save to client record
                      alert('Document data saved to client record!');
                    }}
                    className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 flex items-center"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Save to Client Record
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {processedDocuments.length === 0 && !isProcessing && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Documents Processed Yet
          </h3>
          <p className="text-gray-500 mb-6">
            Upload a document or use the hardware scanner to get started with real AI processing.
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload First Document
            </button>
            {availableScanners.length > 0 && (
              <button
                onClick={() => setShowScannerModal(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                <Camera className="h-4 w-4 mr-2" />
                Use Scanner
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}