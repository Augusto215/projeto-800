import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle, Clock, X, Filter, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Alert {
  id: string;
  user_id: string;
  type: 'bill' | 'employee' | 'expense' | 'achievement' | 'tax' | 'asset' | 'investment';
  title: string;
  description: string;
  date: string;
  priority: 'high' | 'medium' | 'low';
  is_read: boolean;
  related_id?: string;
  related_entity?: string;
  action_path?: string;
  action_label?: string;
  created_at: string;
  expires_at?: string;
}

export default function SmartAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (user && startDate && endDate) {
      fetchAlerts();
    }
  }, [user, filter, startDate, endDate]);

  // Initialize date range
  useEffect(() => {
    const date = new Date();
    const start = new Date();
    start.setDate(date.getDate() - 30);
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(date.toISOString().split('T')[0]);
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('alerts')
        .select('*')
        .eq('user_id', user?.id);
      
      // Apply date range filter
      query = query.gte('date', startDate).lte('date', endDate);

      // Apply status filter
      if (filter === 'unread') {
        query = query.eq('is_read', false);
      } else if (filter === 'high') {
        query = query.eq('priority', 'high');
      }
      
      // Order by priority and date
      query = query.order('priority', { ascending: false }).order('date', { ascending: false });
      
      const { data, error } = await query;
      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      if (error) throw error;
      
      setAlerts(alerts.map(alert => 
        alert.id === alertId ? { ...alert, is_read: true } : alert
      ));
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const deleteAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;
      
      setAlerts(alerts.filter(alert => alert.id !== alertId));
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const updateAllBillAlerts = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.rpc('update_all_bill_alerts');
      
      if (error) throw error;
      
      // Refetch alerts after updating
      fetchAlerts();
    } catch (err) {
      console.error('Error updating bill alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAlertIcon = (type: string, priority: string) => {
    const iconClass = priority === 'high' ? 'text-red-500' : 
                     priority === 'medium' ? 'text-yellow-500' : 'text-blue-500';
    
    switch (type) {
      case 'bill':
        return <AlertTriangle className={`h-5 w-5 ${iconClass}`} />;
      case 'achievement':
        return <CheckCircle className={`h-5 w-5 ${iconClass}`} />;
      default:
        return <Bell className={`h-5 w-5 ${iconClass}`} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500 bg-red-50';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'low':
        return 'border-l-blue-500 bg-blue-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    switch (filter) {
      case 'unread':
        return !alert.is_read;
      case 'high':
        return alert.priority === 'high';
      default:
        return true;
    }
  });

  const displayedAlerts = showAll ? filteredAlerts : filteredAlerts.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Alertas Inteligentes</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Notificações importantes sobre suas finanças</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <DateRangeSelector 
            onRangeChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }} 
          />
        
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="all">Todos</option>
              <option value="unread">Não lidos</option>
              <option value="high">Alta prioridade</option>
            </select>
          </div>
          <button
            onClick={updateAllBillAlerts}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center space-x-1"
            title="Atualizar alertas de contas"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-red-600 p-4 sm:p-6 rounded-xl text-white shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Alta Prioridade</p>
              <p className="text-xl sm:text-3xl font-bold mt-1">
                {alerts.filter(a => a.priority === 'high' && !a.is_read).length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-yellow-600 p-4 sm:p-6 rounded-xl text-white shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Não Lidos</p>
              <p className="text-xl sm:text-3xl font-bold mt-1">
                {alerts.filter(a => !a.is_read).length}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <Bell className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-green-600 p-4 sm:p-6 rounded-xl text-white shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Total</p>
              <p className="text-xl sm:text-3xl font-bold mt-1">{alerts.length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Seus Alertas</h2>
        </div>
        
        <div className="divide-y divide-gray-100">
          {filteredAlerts.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <Bell className="h-10 sm:h-12 w-10 sm:w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Nenhum alerta encontrado</h3>
              <p className="text-sm sm:text-base text-gray-500">
                {filter === 'all' 
                  ? 'Você não tem alertas no momento.'
                  : `Nenhum alerta ${filter === 'unread' ? 'não lido' : 'de alta prioridade'} encontrado.`
                }
              </p>
            </div>
          ) : (
            <>
              {displayedAlerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`p-4 sm:p-6 border-l-4 ${getPriorityColor(alert.priority)} ${
                    !alert.is_read ? 'bg-opacity-100' : 'bg-opacity-50'
                  } hover:bg-opacity-75 transition-all duration-200`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between">
                    <div className="flex items-start space-x-3 sm:space-x-4">
                      <div className="mt-1">
                        {getAlertIcon(alert.type, alert.priority)}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mb-2">
                          <h3 className={`font-medium text-sm sm:text-base ${!alert.is_read ? 'text-gray-900' : 'text-gray-600'}`}>
                            {alert.title} 
                            {alert.related_entity === 'bills' && (
                              <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                Conta
                              </span>
                            )}
                          </h3>
                          {!alert.is_read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full hidden sm:block"></span>
                          )}
                          <span className={`text-xs px-2 py-1 rounded-full mt-1 sm:mt-0 inline-flex w-fit ${
                            alert.priority === 'high' ? 'bg-red-100 text-red-700' :
                            alert.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {alert.priority === 'high' ? 'Alta' : 
                             alert.priority === 'medium' ? 'Média' : 'Baixa'}
                          </span>
                        </div>
                        
                        <p className={`text-xs sm:text-sm mb-3 ${!alert.is_read ? 'text-gray-700' : 'text-gray-500'}`}>
                          {alert.description}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {new Date(alert.date).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                          
                          {alert.expires_at && (
                            <div className="flex items-center space-x-1">
                              <span>Expira em:</span>
                              <span>
                                {new Date(alert.expires_at).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 mt-3 sm:mt-0 sm:ml-4">
                      <div className="flex items-center space-x-2">
                        {alert.action_path && (
                          <a 
                            href={alert.action_path} 
                            className="px-3 sm:px-4 py-1 sm:py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors duration-200"
                          >
                            {alert.action_label || 'Ver Detalhes'}
                          </a>
                        )}
                        
                        {!alert.action_path && (
                          <button className="px-3 sm:px-4 py-1 sm:py-2 bg-gray-100 text-gray-600 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-200 transition-colors duration-200">
                            Detalhes
                          </button>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {!alert.is_read && (
                          <button
                            onClick={() => markAsRead(alert.id)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                            title="Marcar como lido"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => deleteAlert(alert.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                          title="Excluir alerta"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredAlerts.length > 5 && !showAll && (
                <div className="p-4 text-center border-t border-gray-100">
                  <button
                    onClick={() => setShowAll(true)}
                    className="text-indigo-600 hover:text-indigo-700 font-medium text-sm transition-colors duration-200"
                  >
                    Ver mais {filteredAlerts.length - 5} alertas
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}