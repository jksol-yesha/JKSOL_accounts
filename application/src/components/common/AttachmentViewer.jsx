import React, { useState, useCallback, useEffect, useRef, Component } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, AlertTriangle } from 'lucide-react';
import { buildAttachmentUrl, downloadAttachmentFile } from '../../services/api';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure pdf.js worker using local file
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/** Error Boundary to prevent pdf.js crashes from taking down the whole app */
class AttachmentErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('AttachmentViewer crashed:', error, info);
    }

    componentDidUpdate(prevProps) {
        if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ hasError: false });
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={this.props.onClose} />
                    <div className="relative bg-white rounded-xl shadow-2xl flex flex-col items-center justify-center gap-4 p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                        <AlertTriangle size={32} className="text-amber-500" />
                        <h3 className="text-[14px] font-bold text-slate-800">Unable to preview attachment</h3>
                        <p className="text-[12px] text-slate-500 text-center">The file could not be displayed. Try downloading it instead.</p>
                        <button
                            type="button"
                            onClick={this.props.onClose}
                            className="mt-2 px-4 py-2 text-[12px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const PDF_DOCUMENT_OPTIONS = {
    cMapUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
    isEvalSupported: false,
    useWorkerFetch: false,
};

const AttachmentViewer = ({ path, isOpen, onClose }) => {
    const [numPages, setNumPages] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.2);
    const [pdfLoadError, setPdfLoadError] = useState(false);
    const [isPageRendered, setIsPageRendered] = useState(false);
    const [isImageLoaded, setIsImageLoaded] = useState(false);
    const prevPathRef = useRef(null);

    const fullUrl = path ? buildAttachmentUrl(path) : '';
    const isImage = path?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isPdf = path?.match(/\.(pdf)$/i);

    // Reset state when path changes or viewer closes
    useEffect(() => {
        if (!isOpen || !path) {
            setNumPages(null);
            setCurrentPage(1);
            setScale(1.2);
            setPdfLoadError(false);
            setIsPageRendered(false);
            setIsImageLoaded(false);
            prevPathRef.current = null;
            return;
        }
        if (path !== prevPathRef.current) {
            setNumPages(null);
            setCurrentPage(1);
            setPdfLoadError(false);
            setIsPageRendered(false);
            setIsImageLoaded(false);
            prevPathRef.current = path;
        }
    }, [isOpen, path]);

    const onDocumentLoadSuccess = useCallback(({ numPages: pages }) => {
        setNumPages(pages);
        setCurrentPage(1);
        setPdfLoadError(false);
    }, []);

    const onDocumentLoadError = useCallback((error) => {
        console.error('PDF load error:', error);
        setPdfLoadError(true);
    }, []);

    const onPageRenderSuccess = useCallback(() => {
        setIsPageRendered(true);
    }, []);

    const goToPage = (page) => {
        if (page >= 1 && page <= numPages) {
            setIsPageRendered(false);
            setCurrentPage(page);
        }
    };

    const zoomIn = () => setScale((s) => Math.min(s + 0.2, 3));
    const zoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));

    const handleDownload = () => {
        if (!path) return;
        void downloadAttachmentFile(path).catch((error) => {
            console.error('Failed to download attachment:', error);
        });
    };

    if (!isOpen || !path) return null;

    const contentReady = isPdf ? isPageRendered : isImage ? isImageLoaded : true;

    return (
        <AttachmentErrorBoundary resetKey={path} onClose={onClose}>
            <div
                className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm av-fade-in" />

                {/* Modal */}
                <div
                    className="relative bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-4xl overflow-hidden av-modal-in"
                    style={{ height: '85vh' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-white flex-none">
                        <div className="flex items-center gap-3">
                            <h3 className="text-[13px] font-bold text-slate-800 tracking-tight">
                                Attachment
                            </h3>
                            {isPdf && numPages && (
                                <span className="text-[11px] font-medium text-slate-400 transition-opacity duration-200"
                                    style={{ opacity: isPageRendered ? 1 : 0 }}
                                >
                                    {numPages} {numPages === 1 ? 'page' : 'pages'}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5">
                            {isPdf && !pdfLoadError && (
                                <>
                                    <button type="button" onClick={zoomOut}
                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                                        title="Zoom out">
                                        <ZoomOut size={15} strokeWidth={2} />
                                    </button>
                                    <span className="text-[11px] font-semibold text-slate-500 min-w-[36px] text-center tabular-nums">
                                        {Math.round(scale * 100)}%
                                    </span>
                                    <button type="button" onClick={zoomIn}
                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                                        title="Zoom in">
                                        <ZoomIn size={15} strokeWidth={2} />
                                    </button>
                                    <div className="w-px h-5 bg-slate-200 mx-1" />
                                </>
                            )}
                            <button type="button" onClick={handleDownload}
                                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5 shadow-sm">
                                <Download size={14} strokeWidth={2.5} />
                                <span className="text-[11px] font-extrabold uppercase tracking-widest">Download</span>
                            </button>
                            <button onClick={onClose}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors">
                                <X size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    {/* Content area */}
                    <div className="flex-1 overflow-auto bg-slate-50/80 relative min-h-0">
                        {/* Loading spinner */}
                        <div
                            className="absolute inset-0 flex items-center justify-center z-10 transition-opacity duration-300 pointer-events-none"
                            style={{ opacity: contentReady ? 0 : 1 }}
                        >
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                                <span className="text-[12px] font-medium text-slate-400">
                                    Loading...
                                </span>
                            </div>
                        </div>

                        {/* Rendered content */}
                        <div
                            className="w-full h-full flex flex-col items-center transition-opacity duration-300"
                            style={{ opacity: contentReady ? 1 : 0 }}
                        >
                            {isImage ? (
                                <div className="p-6 flex items-center justify-center flex-1 w-full">
                                    <img
                                        src={fullUrl}
                                        alt="Attachment"
                                        className="max-w-full max-h-full object-contain rounded-lg border border-slate-200 shadow-sm bg-white"
                                        onLoad={() => setIsImageLoaded(true)}
                                    />
                                </div>
                            ) : isPdf && !pdfLoadError ? (
                                <div className="py-4 px-4 flex flex-col items-center gap-4 w-full overflow-auto flex-1">
                                    <Document
                                        file={fullUrl}
                                        onLoadSuccess={onDocumentLoadSuccess}
                                        onLoadError={onDocumentLoadError}
                                        loading={null}
                                        error={null}
                                        options={PDF_DOCUMENT_OPTIONS}
                                    >
                                        <Page
                                            pageNumber={currentPage}
                                            scale={scale}
                                            className="shadow-lg rounded-lg overflow-hidden border border-slate-200"
                                            renderAnnotationLayer={false}
                                            renderTextLayer={false}
                                            onRenderSuccess={onPageRenderSuccess}
                                            loading={null}
                                        />
                                    </Document>
                                </div>
                            ) : pdfLoadError ? (
                                <div className="p-6 flex flex-col items-center justify-center flex-1 w-full gap-3">
                                    <AlertTriangle size={28} className="text-amber-500" />
                                    <span className="text-[13px] font-medium text-slate-600">Failed to load document</span>
                                    <p className="text-[11px] text-slate-400">Try downloading the file instead</p>
                                </div>
                            ) : (
                                <div className="p-6 flex items-center justify-center flex-1 w-full">
                                    <iframe
                                        src={fullUrl}
                                        className="w-full h-full bg-white rounded-lg border border-slate-200 shadow-sm"
                                        title="Attachment Preview"
                                        onLoad={() => setIsImageLoaded(true)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* PDF Pagination */}
                    {isPdf && !pdfLoadError && (
                        <div
                            className="flex items-center justify-center gap-3 px-5 py-2.5 border-t border-slate-100 bg-white flex-none transition-opacity duration-200"
                            style={{ opacity: numPages && numPages > 1 && isPageRendered ? 1 : 0, height: numPages && numPages > 1 ? 'auto' : 0, overflow: 'hidden' }}
                        >
                            <button type="button" onClick={() => goToPage(currentPage - 1)}
                                disabled={currentPage <= 1}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                <ChevronLeft size={16} strokeWidth={2.5} />
                            </button>
                            <span className="text-[12px] font-semibold text-slate-600 tabular-nums">
                                Page {currentPage} of {numPages || 1}
                            </span>
                            <button type="button" onClick={() => goToPage(currentPage + 1)}
                                disabled={currentPage >= (numPages || 1)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                <ChevronRight size={16} strokeWidth={2.5} />
                            </button>
                        </div>
                    )}
                </div>

                <style>{`
                    .av-fade-in {
                        animation: avFadeIn 200ms ease-out both;
                    }
                    .av-modal-in {
                        animation: avModalIn 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
                    }
                    @keyframes avFadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes avModalIn {
                        from {
                            opacity: 0;
                            transform: scale(0.97) translateY(6px);
                        }
                        to {
                            opacity: 1;
                            transform: scale(1) translateY(0);
                        }
                    }
                `}</style>
            </div>
        </AttachmentErrorBoundary>
    );
};

export default AttachmentViewer;
