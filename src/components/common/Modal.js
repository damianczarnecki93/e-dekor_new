import React from 'react';
import { XCircle } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, maxWidth = 'md', canBeClosed = true }) => {
    if (!isOpen) return null;
    const maxWidthClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl', '4xl': 'max-w-4xl' }[maxWidth];
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-2 sm:p-4 animate-fade-in">
            <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full m-4 ${maxWidthClass} flex flex-col max-h-[90vh]`}>
                <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h3>
                    {canBeClosed && (
                        <button onClick={onClose} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm p-1.5">
                            <XCircle className="w-6 h-6" />
                        </button>
                    )}
                </div>
                <div className="p-6 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
};

export default Modal;