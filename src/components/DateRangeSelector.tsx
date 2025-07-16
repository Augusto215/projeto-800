import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react';

interface DateRangeSelectorProps {
  onRangeChange: (startDate: string, endDate: string) => void;
  className?: string;
  defaultRange?: 'today' | '7days' | '30days' | '90days' | '365days' | 'ytd' | 'custom';
}

type PresetRange = 'today' | '7days' | '30days' | '90days' | '365days' | 'ytd' | 'custom';

export default function DateRangeSelector({ 
  onRangeChange, 
  className = '',
  defaultRange = '30days'
}: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<PresetRange>(defaultRange as PresetRange);
  const [startDate, setStartDate] = useState<string>(() => {
    // Default to last 30 days
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Set initial dates based on default range
  useEffect(() => {
    handlePresetSelect(defaultRange as PresetRange, false);
  }, [defaultRange]);

  const handlePresetSelect = (preset: PresetRange, closeDropdown = true) => {
    const today = new Date();
    let start = new Date();
    
    switch (preset) {
      case 'today':
        start = new Date(today);
        break;
      case '7days':
        start = new Date(today);
        start.setDate(today.getDate() - 7);
        break;
      case '30days':
        start = new Date(today);
        start.setDate(today.getDate() - 30);
        break;
      case '90days':
        start = new Date(today);
        start.setDate(today.getDate() - 90);
        break;
      case '365days':
        start = new Date(today);
        start.setDate(today.getDate() - 365);
        break;
      case 'ytd':
        start = new Date(today.getFullYear(), 0, 1); // January 1st of current year
        break;
      case 'custom':
        // Don't change dates for custom, just set the preset
        setSelectedRange(preset);
        return;
    }
    
    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = today.toISOString().split('T')[0];
    
    setStartDate(startDateStr);
    setEndDate(endDateStr);
    setSelectedRange(preset);
    onRangeChange(startDateStr, endDateStr);
    
    if (preset !== 'custom' && closeDropdown) {
      setIsOpen(false);
    }
  };

  const handleCustomDateChange = () => {
    onRangeChange(startDate, endDate);
    setIsOpen(false);
  };

  const formatDisplayDate = () => {
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR');
    };

    switch (selectedRange) {
      case 'today':
        return 'Hoje';
      case '7days':
        return 'Últimos 7 dias';
      case '30days':
        return 'Últimos 30 dias';
      case '90days':
        return 'Últimos 90 dias';
      case '365days':
        return 'Último ano';
      case 'ytd':
        return 'Desde o início do ano';
      case 'custom':
        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
      default:
        return 'Selecione um período';
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isOpen && !target.closest('.date-range-selector')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative date-range-selector ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Calendar className="h-4 w-4 text-gray-500" />
        <span className="text-sm">{formatDisplayDate()}</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
          <div className="p-4 space-y-3">
            <h3 className="font-medium text-gray-700 mb-2">Período</h3>
            
            <div className="space-y-2">
              {[
                { id: 'today', label: 'Hoje' },
                { id: '7days', label: 'Últimos 7 dias' },
                { id: '30days', label: 'Últimos 30 dias' },
                { id: '90days', label: 'Últimos 90 dias' },
                { id: '365days', label: 'Último ano' },
                { id: 'ytd', label: 'Desde o início do ano' },
                { id: 'custom', label: 'Personalizado' }
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => handlePresetSelect(option.id as PresetRange)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                    selectedRange === option.id
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            
            {selectedRange === 'custom' && (
              <div className="pt-2 space-y-3 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Data inicial
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Data final
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <button
                  onClick={handleCustomDateChange}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  Aplicar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}