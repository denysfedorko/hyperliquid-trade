import React, { useState, useEffect, useRef } from 'react';

interface IProps {
  options: string[];
  selected?: string;
  setSelected?: (value: string) => void;
};

const DropdownDynamic = ({
  options,
  selected,
  setSelected
}: IProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [alignLeft, setAlignLeft] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Close dropdown on outside click
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      // Determine button position relative to viewport width
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      // Align left if button is on left half, else align right
      setAlignLeft(rect.left < viewportWidth / 2);
    }
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        ref={buttonRef}
        className="inline-flex w-full gap-1 justify-center items-center rounded-md py-2 text-[12px] font-normal font-inter text-white"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span>
          {selected}
        </span>
        <svg
          className="h-3 w-3"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`z-99 absolute w-56 origin-top-right rounded-md bg-[#1A1A1A] shadow-lg border border-gray-600 focus:outline-none z-10 ${
            alignLeft ? 'left-0' : 'right-0'
          }`}
        >
          <div className="py-1">
            {options.map(option => (
              <div 
                key={option}
                className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white font-inter"
                onClick={() => {
                  setSelected?.(option);
                  setIsOpen(false);
                }}
              >
                {option}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DropdownDynamic;
