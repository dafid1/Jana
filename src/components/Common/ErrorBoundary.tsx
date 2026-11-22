import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  isChunkError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      isChunkError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const message = error?.message || String(error);
    const isChunkError =
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Importing a module script failed') ||
      message.includes('error loading dynamically imported module');

    return {
      hasError: true,
      isChunkError,
      errorMessage: message,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('JanaX ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    if (this.state.isChunkError) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, isChunkError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="h-dvh w-screen flex items-center justify-center p-5 bg-[#0e1621] text-white select-none"
        >
          <div className="w-full max-w-md rounded-3xl p-6 bg-[#17212b] border border-[#2b3a4a] shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h2 className="text-base font-bold">
              {this.state.isChunkError
                ? 'تم تحديث التطبيق في الخلفية'
                : 'حدث خطأ غير متوقع في الواجهة'}
            </h2>

            <p className="text-xs text-[#7f91a4] leading-relaxed">
              {this.state.isChunkError
                ? 'يتطلب تحميل أحدث ملفات الواجهة إعادة تحديث الصفحة للمتابعة بسلاسة.'
                : 'يمكنك إعادة المحاولة أو تحديث الصفحة لاستعادة الجلسة بأمان.'}
            </p>

            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white text-xs font-bold cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{this.state.isChunkError ? 'تحديث الصفحة' : 'إعادة المحاولة'}</span>
              </button>
              {!this.state.isChunkError && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-4 py-2.5 rounded-xl bg-[#242f3d] hover:bg-[#2c394b] text-xs font-bold cursor-pointer"
                >
                  إعادة تحميل
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
