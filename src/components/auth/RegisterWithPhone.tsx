import React, { useState } from 'react';
import { Mail, Phone, User, Lock, Eye, EyeOff, Send, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useObserveLandingStore } from '../stores/LandingStore';

interface RegisterWithPhoneProps {
  onSuccess: (userData?: any) => void;
  onBack: () => void;
}

export default function RegisterWithPhone({ onSuccess, onBack }: RegisterWithPhoneProps) {
  const store = useObserveLandingStore();
  const { signUp } = useAuth();
  const [step, setStep] = useState<'details' | 'verification'>('details');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    verificationCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === 'phone') {
      // Format phone number as (99) 99999-9999
      let formattedValue = value.replace(/\D/g, ''); // Remove non-digits
      
      if (formattedValue.length <= 2) {
        formattedValue = formattedValue.replace(/^(\d{0,2})/, '($1');
      } else if (formattedValue.length <= 7) {
        formattedValue = formattedValue.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
      } else {
        formattedValue = formattedValue.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
      }
      
      setFormData({ ...formData, [name]: formattedValue });
    } else if (name === 'verificationCode') {
      // Only allow digits and max 6 characters
      const codeValue = value.replace(/\D/g, '').slice(0, 6);
      setFormData({ ...formData, [name]: codeValue });
    } else {
      setFormData({ ...formData, [name]: value });
    }

    if (error) setError('');
  };

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    store.setIsLoading(true);
    setError('');
  
    try {
      // Validate phone format
      if (!/^\(\d{2}\) \d{5}-\d{4}$/.test(formData.phone)) {
        throw new Error('Telefone inválido. Use o formato (99) 99999-9999');
      }
  
      // Register user with Supabase
      const { error } = await signUp(formData.email, formData.password, formData.fullName);
  
      if (error) {
        throw new Error(error.message);
      }
      
      // Send verification code
      await sendVerificationCode();

      // Move to verification step
      setStep('verification');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      store.setIsLoading(false);
    }
  };

  const sendVerificationCode = async () => {
    if (!formData.email) return;

    try {
      // Get user profile
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('email', formData.email)
        .limit(1);

      if (profileError) throw profileError;
      if (!profiles || profiles.length === 0) {
        throw new Error('Perfil não encontrado');
      }

      const userId = profiles[0].user_id;

      // Generate a random 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Set expiration time (30 minutes from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);

      // Update profile with phone and verification data
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          phone: formData.phone,
          phone_verification_code: code,
          phone_verification_expires: expiresAt.toISOString(),
          phone_verification_attempts: 0,
          phone_verification_status: 'pending'
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // In a real app, this would send an SMS via Twilio
      console.log(`Verification code for ${formData.phone}: ${code}`); // For demo purposes only

      setSuccess('Código de verificação enviado para seu telefone.');
    } catch (err) {
      console.error('Error sending verification code:', err);
      throw new Error('Erro ao enviar código de verificação');
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    store.setIsLoading(true);
    setError('');

    try {
      if (formData.verificationCode.length !== 6) {
        throw new Error('O código deve ter 6 dígitos');
      }

      // Get user profile
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, phone_verification_code, phone_verification_expires, phone_verification_attempts')
        .eq('email', formData.email)
        .limit(1);

      if (profileError) throw profileError;
      if (!profiles || profiles.length === 0) {
        throw new Error('Perfil não encontrado');
      }

      const profile = profiles[0];

      // Check if code has expired
      if (profile.phone_verification_expires && new Date(profile.phone_verification_expires) < new Date()) {
        throw new Error('Código expirado. Solicite um novo código.');
      }

      // Check if too many attempts
      if (profile.phone_verification_attempts >= 5) {
        throw new Error('Muitas tentativas. Solicite um novo código.');
      }

      // Increment attempts
      await supabase
        .from('profiles')
        .update({
          phone_verification_attempts: (profile.phone_verification_attempts || 0) + 1
        })
        .eq('user_id', profile.user_id);

      // Check if code matches
      if (profile.phone_verification_code !== formData.verificationCode) {
        throw new Error('Código inválido. Tente novamente.');
      }

      // Code is valid, mark phone as verified
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          phone_verified: true,
          phone_verification_status: 'verified',
          phone_verification_code: null,
          phone_verification_expires: null
        })
        .eq('user_id', profile.user_id);

      if (updateError) throw updateError;

      setSuccess('Telefone verificado com sucesso!');
      
      setTimeout(() => {
        onSuccess({
          email: formData.email,
          fullName: formData.fullName,
          phone: formData.phone
        });
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      store.setIsLoading(false);
    }
  };

  const resendVerificationCode = async () => {
    store.setIsLoading(true);
    setError('');

    try {
      await sendVerificationCode();
      setSuccess('Novo código de verificação enviado!');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      store.setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {step === 'details' ? (
        <>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Criar Conta com Telefone</h2>
            <p className="text-gray-600 mt-2">
              Preencha seus dados e verifique seu telefone para maior segurança
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmitDetails} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="Seu nome completo"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors duration-200 text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="seu@email.com"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors duration-200 text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="(99) 99999-9999"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors duration-200 text-gray-100"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Você receberá um código de verificação neste número
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Sua senha"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors duration-200 text-gray-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={store.isLoading}
                className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center justify-center space-x-2 shadow-sm"
              >
                {store.isLoading ? (
                  <span>Processando...</span>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Continuar</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={onBack}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors duration-200 flex items-center justify-center mx-auto"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span>Voltar</span>
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Verificar Telefone</h2>
            <p className="text-gray-600 mt-2">
              Digite o código de 6 dígitos enviado para {formData.phone}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-green-700 text-sm flex items-center">
                <CheckCircle className="h-4 w-4 mr-2" />
                {success}
              </p>
            </div>
          )}

          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código de Verificação</label>
              <input
                type="text"
                name="verificationCode"
                value={formData.verificationCode}
                onChange={handleInputChange}
                placeholder="Digite o código de 6 dígitos"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors duration-200 text-center text-2xl tracking-widest bg-white"
                maxLength={6}
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={store.isLoading || formData.verificationCode.length !== 6}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {store.isLoading ? 'Verificando...' : 'Verificar e Criar Conta'}
              </button>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">
                Não recebeu o código?
              </p>
              <button
                type="button"
                onClick={resendVerificationCode}
                disabled={store.isLoading}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors duration-200"
              >
                Reenviar código
              </button>
              <button
                type="button"
                onClick={() => setStep('details')}
                className="block w-full text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors duration-200 mt-4"
              >
                <ArrowLeft className="h-4 w-4 inline mr-1" />
                Voltar e editar informações
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}