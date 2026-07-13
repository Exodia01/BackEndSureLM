'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

type DocStatus = 'idle' | 'uploaded' | 'validating' | 'validated' | 'failed';
type ScanState = 'idle' | 'uploading' | 'processing' | 'ready';
type DocumentType = 'aadhaar' | 'pan' | 'voter_id' | 'passport' | 'driving_license';

interface DocumentItem {
  id: string;
  type: DocumentType;
  name: string;
  isMandatory: boolean;
  status: DocStatus;
}

interface OCRResult {
  text: string;
  data: {
    name?: string;
    aadhaar?: string;
    dob?: string;
    pan?: string;
  };
}

interface ChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  mandatoryDocs: DocumentItem[];
  initialIndex?: number;
  onValidate?: (docId: string, isValid: boolean) => void;
  onSaveBatch?: (docs: DocumentItem[]) => void;
}

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  aadhaar: 'Aadhaar Card',
  pan: 'PAN Card',
  voter_id: 'Voter ID',
  passport: 'Passport',
  driving_license: 'Driving License'
};

export default function ChecklistModal({
  isOpen,
  onClose,
  mandatoryDocs,
  initialIndex = 0,
  onValidate,
  onSaveBatch
}: ChecklistModalProps) {
  const [docIndex, setDocIndex] = useState(initialIndex);
  const [uploads, setUploads] = useState<Record<string, DocStatus>>({});
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [showFullData, setShowFullData] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDocIndex(initialIndex);
      setUploads({});
      setScanState('idle');
      setSelectedFile(null);
      setPreviewUrl(null);
      setOcrResult(null);
    }
  }, [isOpen, initialIndex]);

  const currentDoc = mandatoryDocs[docIndex];
  const completedCount = Object.values(uploads).filter((s) => s === 'validated').length;
  const totalCount = mandatoryDocs.length;

  const handleUpload = (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please upload a valid image file');
      return;
    }

    setScanState('uploading');
    setSelectedFile(file);
    
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    setTimeout(() => {
      setScanState('processing');

      setTimeout(() => {
        const mockOCRResult: OCRResult = {
          text: 'This is the extracted text from the document. It contains various fields like name, date of birth, and identification numbers.',
          data: {
            name: 'John Doe',
            aadhaar: '1234 5678 9012',
            dob: '1990-05-15',
            pan: 'ABCDE1234F'
          }
        };
        
        setOcrResult(mockOCRResult);
        setScanState('ready');
      }, 1500);
    }, 800);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const onSwipeLeft = () => {
    setRejectReason('');
    // Reject logic
    if (currentDoc) {
      setUploads((prev) => ({
        ...prev,
        [currentDoc.id]: 'failed'
      }));
      setScanState('idle');
      setSelectedFile(null);
      setPreviewUrl(null);
      setOcrResult(null);

      setTimeout(() => {
        if (docIndex < mandatoryDocs.length - 1) {
          setDocIndex((prev) => prev + 1);
        }
      }, 300);
    }
  };

  const onSwipeUp = () => {
    setShowFullData(true);
  };

  const onSwipeRight = () => {
    if (currentDoc && onValidate) {
      onValidate(currentDoc.id, true);
      
      setUploads((prev) => ({
        ...prev,
        [currentDoc.id]: 'validated'
      }));
      setScanState('idle');
      setSelectedFile(null);
      setPreviewUrl(null);
      setOcrResult(null);

      setTimeout(() => {
        if (docIndex < mandatoryDocs.length - 1) {
          setDocIndex((prev) => prev + 1);
        }
      }, 300);
    }
  };

  const handleSubmitBatch = () => {
    const validatedDocs = mandatoryDocs.filter(
      (doc) => uploads[doc.id] === 'validated'
    );
    
    if (onSaveBatch && validatedDocs.length > 0) {
      onSaveBatch(validatedDocs);
    }
    onClose();
  };

  const getStatusIcon = (status: DocStatus) => {
    switch (status) {
      case 'validated':
        return <span className="text-green-500">✅</span>;
      case 'uploaded':
      case 'validating':
        return <span className="text-yellow-500">⏳</span>;
      case 'failed':
        return <span className="text-red-500">❌</span>;
      default:
        return <span className="text-gray-400">⚪</span>;
    }
  };

  const getDocTypeBadge = () => {
    if (!currentDoc) return null;
    
    const badgeColors = 'bg-green-100 text-green-800 border-green-300';
    
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badgeColors} inline-flex items-center`}>
        {DOCUMENT_TYPE_LABELS[currentDoc.type]}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-7xl h-[90vh] bg-white rounded-xl shadow-2xl flex overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center bg-white/90 rounded-full hover:bg-gray-100 transition-colors shadow-lg"
        >
          <span className="text-xl font-bold text-gray-600">×</span>
        </button>

        {/* Left Sidebar - Checklist Progress */}
        <div className="w-[30%] bg-gray-50 border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 bg-white">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Document Checklist</h2>
            <p className="text-sm text-gray-500">
              {completedCount}/{totalCount} mandatory documents completed
            </p>
            
            {/* Progress Bar */}
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-[#059669] h-full transition-all duration-500"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>

          {/* Document List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {mandatoryDocs.map((doc, index) => (
              <div 
                key={doc.id}
                className={`p-3 rounded-lg border transition-all ${
                  index === docIndex 
                    ? 'bg-white border-[#059669] shadow-sm ring-1 ring-[#059669]/20' 
                    : 'bg-gray-100/50 border-transparent hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(uploads[doc.id] || 'idle')}
                    <span className={`font-medium ${index === docIndex ? 'text-[#059669]' : 'text-gray-700'}`}>
                      {DOCUMENT_TYPE_LABELS[doc.type]}
                    </span>
                  </div>
                  {doc.isMandatory && (
                    <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">Required</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-white">
            {docIndex < mandatoryDocs.length - 1 ? (
              <button
                onClick={() => setDocIndex((prev) => prev + 1)}
                className="w-full py-3 px-4 bg-[#059669] text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
              >
                <span>Next Document</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSubmitBatch}
                className="w-full py-3 px-4 bg-[#059669] text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Done with Mandatory
              </button>
            )}
            
            <button
              onClick={onClose}
              className="mt-3 w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Right Panel - Upload Area */}
        <div className="w-[70%] bg-white flex flex-col p-8 overflow-y-auto">
          
          {/* Current Document Info */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Upload Document</h3>
            <p className="text-gray-500">{currentDoc?.name}</p>
            <div className="mt-2">
              {getDocTypeBadge()}
            </div>
          </div>

          {/* Upload Zone / Image Preview */}
          <div 
            className={`mb-6 border-3 rounded-xl transition-all duration-300 ${
              dragActive 
                ? 'border-[#059669] bg-green-50' 
                : 'border-dashed border-gray-300 bg-gray-50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {previewUrl ? (
              <div className="relative w-full max-w-[400px] mx-auto">
                {/* Image Preview */}
                <div className="relative rounded-lg overflow-hidden shadow-inner">
                  <Image
                    src={previewUrl}
                    alt="Document Preview"
                    width={300}
                    height={200}
                    className="w-full h-auto object-contain bg-white"
                  />
                </div>

                {/* Swipe Action Buttons */}
                <div className="mt-6 flex justify-center space-x-8">
                  <button
                    onClick={onSwipeLeft}
                    className="group flex flex-col items-center"
                  >
                    <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center transition-colors hover:bg-red-100 shadow-md">
                      ←
                    </div>
                    <span className="mt-2 text-xs font-medium text-gray-600">Reject</span>
                  </button>

                  <button
                    onClick={onSwipeUp}
                    className="group flex flex-col items-center"
                  >
                    <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center transition-colors hover:bg-blue-100 shadow-md">
                      ↑
                    </div>
                    <span className="mt-2 text-xs font-medium text-gray-600">Review</span>
                  </button>

                  <button
                    onClick={onSwipeRight}
                    className="group flex flex-col items-center"
                  >
                    <div className="w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center transition-colors hover:bg-green-100 shadow-md">
                      →
                    </div>
                    <span className="mt-2 text-xs font-medium text-gray-600">Confirm & Save</span>
                  </button>
                </div>

                {/* OCR Results (shown when ready) */}
                {scanState === 'ready' && ocrResult && (
                  <div className="mt-8 bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">OCR Results</h4>
                    
                    {/* Extracted Text */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Extracted Text</p>
                      <p className="text-sm text-gray-700 italic max-h-12 overflow-hidden text-ellipsis line-clamp-3">
                        "{ocrResult.text}"
                      </p>
                    </div>

                    {/* Structured Data Table */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {ocrResult.data.name && (
                        <div className="bg-white rounded p-2 border border-gray-200">
                          <p className="text-[10px] text-gray-500 uppercase">Name</p>
                          <p className="text-sm font-medium text-gray-900">{ocrResult.data.name}</p>
                        </div>
                      )}
                      {ocrResult.data.aadhaar && (
                        <div className="bg-white rounded p-2 border border-gray-200">
                          <p className="text-[10px] text-gray-500 uppercase">Aadhaar</p>
                          <p className="text-sm font-medium text-gray-900">{ocrResult.data.aadhaar}</p>
                        </div>
                      )}
                      {ocrResult.data.dob && (
                        <div className="bg-white rounded p-2 border border-gray-200">
                          <p className="text-[10px] text-gray-500 uppercase">DOB</p>
                          <p className="text-sm font-medium text-gray-900">{ocrResult.data.dob}</p>
                        </div>
                      )}
                      {ocrResult.data.pan && (
                        <div className="bg-white rounded p-2 border border-gray-200">
                          <p className="text-[10px] text-gray-500 uppercase">PAN</p>
                          <p className="text-sm font-medium text-gray-900">{ocrResult.data.pan}</p>
                        </div>
                      )}
                    </div>

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                )}
              </div>
            ) : (
              // Upload Zone (Empty State)
              <div className="py-12 text-center">
                {scanState === 'uploading' ? (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 border-4 border-[#059669] border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-gray-700 font-medium">Uploading document...</p>
                  </div>
                ) : scanState === 'processing' ? (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 border-4 border-[#059669] border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-gray-700 font-medium">Processing with OCR...</p>
                  </div>
                ) : (
                  <>
                    <svg 
                      className="w-16 h-16 text-gray-400 mx-auto mb-4"
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      Drag & drop document image here
                    </p>
                    <p className="text-sm text-gray-500 mb-4">or</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-2 bg-[#059669] text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                      Select File
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-auto pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Instructions</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="mr-2 text-[#059669]">•</span>
                Ensure document is clearly visible with no glare or shadows
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-[#059669]">•</span>
                Use the swipe buttons to review and validate: ← Reject, ↑ Review, → Confirm & Save
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-[#059669]">•</span>
                OCR will auto-extract data after successful upload
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* Full Data Modal Overlay */}
      {showFullData && ocrResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowFullData(false)}
          />
          
          <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in duration-300">
            <button
              onClick={() => setShowFullData(false)}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white rounded-full hover:bg-gray-100 transition-colors"
            >
              <span className="text-xl font-bold text-gray-600">×</span>
            </button>

            <div className="p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Extracted Document Data</h3>
              
              {/* Full Extracted Text */}
              <div className="mb-6">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Full Text Extraction</p>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-48 overflow-y-auto:
                  {
                    'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent':
                      'overflow-y-auto'
                  }"
                >
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{ocrResult.text}</p>
                </div>
              </div>

              {/* Full Data Table */}
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Structured Fields</h4>
              <div className="space-y-2">
                {Object.entries(ocrResult.data).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-sm font-medium text-gray-500 uppercase capitalize">{key.replace('_', ' ')}</span>
                    <span className="text-base font-semibold text-[#059669]">{value}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="mt-6 flex space-x-4">
                <button
                  onClick={() => setShowFullData(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onSwipeRight();
                    setShowFullData(false);
                  }}
                  className="flex-1 py-2 px-4 bg-[#059669] text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Confirm & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}