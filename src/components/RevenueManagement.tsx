import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Edit2, Trash2, TrendingUp, Home, Building, Receipt } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import DateRangeSelector from './DateRangeSelector';

interface IncomeSource {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'yearly' | 'one-time';
  category: string;
  next_payment: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tax_rate: number;
}

export default function RevenueManagement() {
  const { user } = useAuth();
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMonthlyIncome, setTotalMonthlyIncome] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    frequency: 'monthly' as const,
    category: '',
    next_payment: '',
    tax_rate: ''
  });

  useEffect(() => {
    if (user) {
      fetchIncomeSources();
    }
  }, [user, startDate, endDate]);

  const fetchIncomeSources = async () => {
    setLoading(true);
    try {
      // Fetch income sources from income_sources table
      const { data: incomeSources, error: incomeError } = await supabase
        .from('income_sources')
        .select('*')
        .eq('user_id', user?.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (incomeError) throw incomeError;
      
      // Fetch rental income from real_estate table
      const { data: realEstateData, error: realEstateError } = await supabase
        .from('real_estate')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_rented', true);
        
      if (realEstateError) throw realEstateError;
      
      // Fetch dividend income from investments table
      const { data: investmentsData, error: investmentsError } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', user?.id);
        
      if (investmentsError) throw investmentsError;
      
      // Fetch transaction income
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('type', 'income');
        
      if (transactionsError) throw transactionsError;
      
      // Convert rental properties to income sources format
      const rentalIncome = (realEstateData || []).map(property => ({
        id: `rental-${property.id}`,
        user_id: property.user_id,
        name: `Aluguel: ${property.address}`,
        amount: property.monthly_rent || 0,
        frequency: 'monthly' as const,
        category: 'Aluguel',
        next_payment: null,
        is_active: true,
        tax_rate: property.tax_rate || 0,
        created_at: property.created_at,
        updated_at: property.updated_at
      }));
      
      // Convert investments with dividends to income sources format
      const dividendIncome = (investmentsData || [])
        .filter(investment => investment.dividend_yield || investment.monthly_income)
        .map(investment => {
          let monthlyAmount = 0;
          
          if (investment.dividend_yield && investment.quantity && investment.current_price) {
            const currentValue = investment.quantity * investment.current_price;
            monthlyAmount = (currentValue * investment.dividend_yield) / 100 / 12;
          } else if (investment.monthly_income) {
            monthlyAmount = investment.monthly_income;
          }
          
          return {
            id: `dividend-${investment.id}`,
            user_id: investment.user_id,
            name: `Dividendos: ${investment.name}`,
            amount: monthlyAmount,
            frequency: 'monthly' as const,
            category: 'Dividendos',
            next_payment: null,
            is_active: true,
            tax_rate: investment.tax_rate || 0,
            created_at: investment.created_at,
            updated_at: investment.updated_at
          };
        });
      
      // Convert transactions to income sources format
      const transactionIncome = (transactionsData || []).map(transaction => ({
        id: `transaction-${transaction.id}`,
        user_id: transaction.user_id,
        name: transaction.description || 'Transação',
        amount: transaction.amount,
        frequency: transaction.is_recurring ? 'monthly' as const : 'one-time' as const,
        category: 'Transações',
        next_payment: null,
        is_active: true,
        tax_rate: transaction.tax_rate || 0,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at
      }));
      
      // Combine all income sources
      const allIncomeSources = [
        ...(incomeSources || [])
      ];

      setIncomeSources(allIncomeSources);
      
      // Calculate actual total monthly income
      const total = allIncomeSources
        .filter(source => source.is_active)
        .reduce((sum, source) => {
          let monthlyAmount = source.amount;
          
          switch (source.frequency) {
            case 'weekly':
              monthlyAmount = source.amount * 4.33;
              break;
            case 'yearly':
              monthlyAmount = source.amount / 12;
              break;
            case 'one-time':
              monthlyAmount = 0;
              break;
          }
          
          return sum + monthlyAmount;
        }, 0);
      
      setTotalMonthlyIncome(total);
    } catch (error) {
      console.error('Error fetching income sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('income_sources')
        .insert([{
          user_id: user.id,
          name: formData.name,
          amount: parseFloat(formData.amount),
          frequency: formData.frequency,
          category: formData.category,
          next_payment: formData.next_payment || null,
          tax_rate: formData.tax_rate ? parseFloat(formData.tax_rate) : null
        }]);

      if (error) throw error;
      
      setFormData({
        name: '',
        amount: '',
        frequency: 'monthly',
        category: '',
        next_payment: '',
        tax_rate: ''
      });
      setShowAddForm(false);
      fetchIncomeSources();
    } catch (error) {
      console.error('Error adding income source:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta fonte de renda?')) return;

    try {
      // Delete from income_sources table
      const { error } = await supabase
        .from('income_sources')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchIncomeSources();
    } catch (error) {
      console.error('Error deleting income source:', error);
    }
  };

  const calculateTotalYearlyIncome = () => {
    return totalMonthlyIncome * 12;
  };

  // Calculate income by category
  const calculateIncomeByCategory = () => {
    const categories: Record<string, number> = {};
    
    incomeSources
      .filter(source => source.is_active)
      .forEach(source => {
        let monthlyAmount = source.amount;
        
        switch (source.frequency) {
          case 'weekly':
            monthlyAmount = source.amount * 4.33;
            break;
          case 'yearly':
            monthlyAmount = source.amount / 12;
            break;
          case 'one-time':
            monthlyAmount = 0;
            break;
        }
        
        if (!categories[source.category]) {
          categories[source.category] = 0;
        }
        
        categories[source.category] += monthlyAmount;
      });
    
    // Convert to array and calculate percentages
    const totalIncome = totalMonthlyIncome;
    const categoriesArray = Object.entries(categories).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalIncome > 0 ? (amount / totalIncome) * 100 : 0
    }));
    
    // Sort by amount (descending)
    return categoriesArray.sort((a, b) => b.amount - a.amount);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatFrequency = (frequency: string) => {
    const frequencies = {
      monthly: 'Mensal',
      weekly: 'Semanal',
      yearly: 'Anual',
      'one-time': 'Única'
    };
    return frequencies[frequency as keyof typeof frequencies] || frequency;
  };

  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'aluguel':
       return <Home className="h-5 w-5 text-orange-500" />;
      case 'dividendos':
       return <Building className="h-5 w-5 text-blue-500" />;
     case 'transações':
       return <Receipt className="h-5 w-5 text-purple-500" />;
     case 'invest':
       return <TrendingUp className="h-5 w-5 text-indigo-500" />;
     case 'carga':
       return <DollarSign className="h-5 w-5 text-green-500" />;
      default:
       return <DollarSign className="h-5 w-5 text-green-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const incomeCategories = calculateIncomeByCategory();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Gestão de Receitas</h1>
          <p className="text-gray-500 mt-1">Gerencie suas fontes de renda</p>
        </div>
        <div className="flex space-x-3">
          <DateRangeSelector 
            onRangeChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }} 
          />
          <button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all duration-200 shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar Fonte de Renda</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Renda Mensal</p>
              <p className="text-3xl font-bold mt-1">R$ {totalMonthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Renda Anual</p>
              <p className="text-3xl font-bold mt-1">R$ {calculateTotalYearlyIncome().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-2xl text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Fontes Ativas</p>
              <p className="text-3xl font-bold mt-1">{incomeSources.filter(s => s.is_active).length}</p>
              <p className="text-purple-100 text-sm">{incomeSources.length} Total</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <div className="h-6 w-6 flex items-center justify-center text-white font-bold">
                {incomeSources.filter(s => s.is_active).length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Income Categories */}
      <div className="bg-white rounded-xl shadow-md p-6 overflow-hidden">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Receitas por Categoria</h2>
        <div className="grid grid-cols-1 gap-4">
          {incomeCategories.map((category, index) => (
            <div key={index} className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-2">
               <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-3 bg-green-500">
                  {getCategoryIcon(category.category)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{category.category}</p>
                  <p className="text-xs text-gray-500">{category.percentage.toFixed(1)}%</p>
                </div>
                <div className="ml-auto">
                  <p className="text-lg font-bold text-green-600">{formatCurrency(category.amount)}</p>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, category.percentage)}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Adicionar Nova Fonte de Renda</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequência</label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({...formData, frequency: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                >
                  <option value="monthly">Mensal</option>
                  <option value="weekly">Semanal</option>
                  <option value="yearly">Anual</option>
                  <option value="one-time">Única</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Próximo Pagamento</label>
                <input
                  type="date"
                  value={formData.next_payment}
                  onChange={(e) => setFormData({...formData, next_payment: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Taxa de Imposto (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({...formData, tax_rate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all duration-200 shadow-sm"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Income Sources List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">Suas Fontes de Renda</h2>
        </div>
        
        <div className="divide-y divide-gray-100">
          {incomeSources.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma fonte de renda cadastrada</h3>
              <p className="text-gray-500">Adicione suas fontes de renda para acompanhar suas receitas.</p>
            </div>
          ) : (
            incomeSources.map((source) => (
              <div key={source.id} className="p-6 hover:bg-gray-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      source.id.startsWith('rental-') ? 'bg-orange-100' : 
                      source.id.startsWith('dividend-') ? 'bg-blue-100' : 
                      'bg-green-100'
                    }`}>
                      {source.id.startsWith('rental-') ? (
                        <Home className="h-6 w-6 text-orange-600" />
                      ) : source.id.startsWith('dividend-') ? (
                        <Building className="h-6 w-6 text-blue-600" />
                      ) : (
                        <DollarSign className="h-6 w-6 text-green-600" />
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center space-x-3">
                        <h3 className="font-medium text-gray-800">{source.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          source.id.startsWith('rental-') ? 'bg-orange-100 text-orange-700' : 
                          source.id.startsWith('dividend-') ? 'bg-blue-100 text-blue-700' : 
                          'bg-green-100 text-green-700'
                        }`}>
                          {source.id.startsWith('rental-') ? 'Aluguel' : 
                           source.id.startsWith('dividend-') ? 'Dividendo' : 
                           source.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatFrequency(source.frequency)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="font-semibold text-lg text-gray-800">
                        R$ {source.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {source.tax_rate > 0 && (
                        <p className="text-sm text-red-600">
                          Imposto: R$ {((source.amount * source.tax_rate) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                    
                    {!source.id.startsWith('rental-') && !source.id.startsWith('dividend-') && (
                      <div className="flex items-center space-x-2">
                        <button 
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(source.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    
                    {(source.id.startsWith('rental-') || source.id.startsWith('dividend-') || source.id.startsWith('transaction-')) && (
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => handleDelete(source.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                          title="Excluir fonte de renda"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}