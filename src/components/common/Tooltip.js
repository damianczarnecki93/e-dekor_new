import React from 'react';

const Tooltip = ({ children, text }) => (
    <div className="relative flex items-center group">
        {children}
        <div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            {text}
        </div>
    </div>
);

export default Tooltip;