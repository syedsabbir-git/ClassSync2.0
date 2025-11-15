import React, { useState, useEffect } from 'react';
import {
  User,
  Users,
  BookOpen,
  CheckCircle,
  FileText,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  Lock,
  UserPlus,
  AlertCircle,
  Loader,
  Download,
  Smartphone,
  Monitor,
  Tablet,
  Zap,
  Wifi,
  Bell,
  Shield,
  Plus
} from 'lucide-react';
import { useAuthActions } from '../hooks/useAuth';
import { useAuth } from '../contexts/AuthContext';
import { isValidEmail, isValidStudentId, isStrongPassword } from '../utils/helpers';

const LandingPage = ({ onAuthSuccess }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [userType, setUserType] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDownloadPage, setShowDownloadPage] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    studentId: '',
    confirmPassword: ''
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  const { signUp, signIn, resetPassword, loading, error, clearError, unverifiedUserInfo } = useAuthActions();
  const { currentUser, userRole, userData, setUnverifiedUser } = useAuth();

  // If there's unverified user info, set it in AuthContext
  useEffect(() => {
    if (unverifiedUserInfo) {
      setUnverifiedUser(unverifiedUserInfo);
    }
  }, [unverifiedUserInfo, setUnverifiedUser]);

  // Rest of your existing handlers...
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    if (validationErrors[name]) {
      setValidationErrors({
        ...validationErrors,
        [name]: ''
      });
    }

    if (error) {
      clearError();
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!isValidEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (activeTab === 'signup' && !isStrongPassword(formData.password)) {
      errors.password = 'Password must be at least 6 characters with letters and numbers';
    }

    if (activeTab === 'signup') {
      if (!formData.name.trim()) {
        errors.name = 'Full name is required';
      }

      if (userType === 'student' && !formData.studentId) {
        errors.studentId = 'Student ID is required';
      } else if (userType === 'student' && !isValidStudentId(formData.studentId)) {
        errors.studentId = 'Please enter a valid student ID (4-10 digits)';
      }

      if (!formData.confirmPassword) {
        errors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSuccessMessage('');

    try {
      if (activeTab === 'login') {
        const result = await signIn({
          email: formData.email,
          password: formData.password
        });

        if (result.success) {
          setSuccessMessage('Login successful! Redirecting...');
        }
      } else {
        const result = await signUp({
          email: formData.email,
          password: formData.password,
          name: formData.name.trim(),
          userType: userType,
          studentId: userType === 'student' ? formData.studentId : null
        });

        if (result.success) {
          setSuccessMessage('Account created successfully! Welcome to ClassSync!');
          setFormData({
            email: '',
            password: '',
            name: '',
            studentId: '',
            confirmPassword: ''
          });
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setValidationErrors({ email: 'Please enter your email address' });
      return;
    }

    if (!isValidEmail(formData.email)) {
      setValidationErrors({ email: 'Please enter a valid email address' });
      return;
    }

    const result = await resetPassword(formData.email);
    if (result.success) {
      setSuccessMessage('Password reset email sent! Check your inbox.');
    }
  };

  React.useEffect(() => {
    if (currentUser && userRole && userData) {
      onAuthSuccess && onAuthSuccess(userData);
    }
  }, [currentUser, userRole, userData, onAuthSuccess]);

  const features = [
    {
      icon: <BookOpen className="w-8 h-8 text-blue-500" />,
      title: "Manage Activities",
      description: "CRs can easily upload and manage assignments, quizzes, and lab tasks"
    },
    {
      icon: <Users className="w-8 h-8 text-green-500" />,
      title: "Section Management",
      description: "Create sections with unique keys for student enrollment"
    },
    {
      icon: <CheckCircle className="w-8 h-8 text-purple-500" />,
      title: "Priority System",
      description: "Organize activities by priority and track completion status"
    },
    {
      icon: <FileText className="w-8 h-8 text-teal-500" />,
      title: "Resource Library",
      description: "Centralized file sharing for lecture notes, materials, and reference documents"
    }
  ];

  // Show download page if requested
  if (showDownloadPage) {
    return <DownloadPage onBack={() => setShowDownloadPage(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden">
                <img
                  src="/logo192.png"
                  alt="ClassSync Logo"
                  className="w-10 h-10 object-cover rounded-xl"
                />
              </div>

              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                ClassSync
              </h1>
            </div>

            {/* Download Button */}
            <button
              onClick={() => setShowDownloadPage(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </header>

      {/* Rest of your existing content... */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Your existing left and right side content stays the same */}
          {/* Left Side - Hero Content */}
          <div className="space-y-8">
            <div className="space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
                Streamline Your
                <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Class Management
                </span>
              </h2>
              <p className="text-xl text-gray-600 leading-relaxed">
                Connect Class Representatives and Students in one unified platform.
                Manage assignments, track activities, and stay organized effortlessly.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 rounded-2xl bg-white/50 backdrop-blur-sm border border-gray-200/50 hover:shadow-lg transition-all duration-300">
                  <div className="flex-shrink-0">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side - Auth Form */}
          <div className="relative">
            <div className="bg-white rounded-3xl shadow-2xl shadow-blue-100 border border-gray-200/50 overflow-hidden">
              {/* Tab Headers */}
              <div className="flex bg-gray-50 border-b border-gray-200">
                <button
                  onClick={() => {
                    setActiveTab('login');
                    clearError();
                    setValidationErrors({});
                    setSuccessMessage('');
                  }}
                  className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${activeTab === 'login'
                    ? 'text-blue-600 bg-white border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setActiveTab('signup');
                    clearError();
                    setValidationErrors({});
                    setSuccessMessage('');
                  }}
                  className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${activeTab === 'signup'
                    ? 'text-blue-600 bg-white border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Sign Up
                </button>
              </div>

              <div className="p-8">
                {/* Success Message */}
                {successMessage && (
                  <div className="mb-6 p-4 bg-green-100 border border-green-200 text-green-700 rounded-xl">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">{successMessage}</span>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="mb-6 p-4 bg-red-100 border border-red-200 text-red-700 rounded-xl">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  </div>
                )}

                {/* User Type Selection - Only for Signup */}
                {activeTab === 'signup' && (
                  <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-700 mb-4">
                      I am a:
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setUserType('student')}
                        className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border-2 transition-all ${userType === 'student'
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <User className="w-5 h-5" />
                        <span className="font-medium">Student</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserType('cr')}
                        className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border-2 transition-all ${userType === 'cr'
                          ? 'border-purple-500 bg-purple-50 text-purple-600'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <Users className="w-5 h-5" />
                        <span className="font-medium">Class Rep</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* All your existing form fields stay the same */}
                <div className="space-y-6">
                  {activeTab === 'signup' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <UserPlus className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationErrors.name ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                            }`}
                          placeholder="Enter your full name"
                        />
                      </div>
                      {validationErrors.name && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'signup' && userType === 'student' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Student ID
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          name="studentId"
                          value={formData.studentId}
                          onChange={handleInputChange}
                          className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationErrors.studentId ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                            }`}
                          placeholder="Enter your student ID"
                        />
                      </div>
                      {validationErrors.studentId && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.studentId}</p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationErrors.email ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                          }`}
                        placeholder="Enter your email"
                      />
                    </div>
                    {validationErrors.email && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className={`block w-full pl-10 pr-10 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationErrors.password ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                          }`}
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    </div>
                    {validationErrors.password && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
                    )}
                  </div>

                  {activeTab === 'signup' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          className={`block w-full pl-10 pr-10 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationErrors.confirmPassword ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                            }`}
                          placeholder="Confirm your password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                          ) : (
                            <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                          )}
                        </button>
                      </div>
                      {validationErrors.confirmPassword && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.confirmPassword}</p>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full flex items-center justify-center space-x-2 px-6 py-3 rounded-xl text-white font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-200"
                  >
                    {loading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {activeTab === 'login' ? 'Sign In' : 'Create Account'}
                        </span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  {activeTab === 'login' && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={loading}
                        className="text-sm text-blue-600 hover:text-blue-500 transition-colors disabled:opacity-50"
                      >
                        Forgot your password?
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 border-t border-gray-200 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p>&copy; 2025 ClassSync. Built for seamless class management.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
// Enhanced Download Page Component with Direct Install Button
const DownloadPage = ({ onBack }) => {
  const [deviceType, setDeviceType] = useState('desktop');
  const [activeGuide, setActiveGuide] = useState('auto');

  useEffect(() => {
    // Detect device type
    const detectDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      if (/ipad|tablet/.test(userAgent)) {
        setDeviceType('tablet');
        setActiveGuide('ios');
      } else if (/iphone/.test(userAgent)) {
        setDeviceType('mobile');
        setActiveGuide('ios');
      } else if (/android|mobile/.test(userAgent)) {
        setDeviceType('mobile');
        setActiveGuide('android');
      } else {
        setDeviceType('desktop');
        setActiveGuide('desktop');
      }
    };

    detectDevice();
  }, []);

  const installGuides = {
    ios: {
      title: "Install on iPhone/iPad",
      icon: <Smartphone className="w-8 h-8 text-blue-600" />,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      steps: [
        {
          title: "Open in Safari",
          description: "Make sure you're using Safari browser (not Chrome or other browsers)",
          icon: "🌐"
        },
        {
          title: "Tap Share Button",
          description: "Look for the Share icon (↑) at the bottom of your screen and tap it",
          icon: "↑"
        },
        {
          title: "Add to Home Screen",
          description: "Scroll down in the share menu and tap 'Add to Home Screen'",
          icon: "📱"
        },
        {
          title: "Customize & Add",
          description: "Edit the app name if you want, then tap 'Add' in the top right",
          icon: "✅"
        }
      ]
    },
    android: {
      title: "Install on Android",
      icon: <Smartphone className="w-8 h-8 text-green-600" />,
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      steps: [
        {
          title: "Open in Chrome",
          description: "Use Chrome browser for the best installation experience",
          icon: "🌐"
        },
        {
          title: "Look for Install Prompt",
          description: "Chrome may show an 'Install' banner at the bottom automatically",
          icon: "⬇️"
        },
        {
          title: "Use Browser Menu",
          description: "If no prompt appears, tap menu (⋮) → 'Add to Home screen' or 'Install app'",
          icon: "⋮"
        },
        {
          title: "Confirm Installation",
          description: "Tap 'Install' or 'Add' to complete the process",
          icon: "✅"
        }
      ]
    },
    desktop: {
      title: "Install on Desktop",
      icon: <Monitor className="w-8 h-8 text-purple-600" />,
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      steps: [
        {
          title: "Use Chrome, Edge, or Firefox",
          description: "Open ClassSync in a supported browser for PWA installation",
          icon: "🌐"
        },
        {
          title: "Find Install Icon",
          description: "Look for the install/download icon (⬇️) in the address bar",
          icon: "⬇️"
        },
        {
          title: "Click Install",
          description: "Click the install icon or use browser menu → 'Install ClassSync'",
          icon: "🖱️"
        },
        {
          title: "Launch App",
          description: "ClassSync will open in its own window and appear in your applications",
          icon: "✅"
        }
      ]
    }
  };

  const benefits = [
    {
      icon: <Zap className="w-6 h-6 text-yellow-600" />,
      title: "Lightning Fast",
      description: "Instant loading and smooth performance"
    },
    {
      icon: <Wifi className="w-6 h-6 text-blue-600" />,
      title: "Works Offline",
      description: "Access content even without internet"
    },
    {
      icon: <Bell className="w-6 h-6 text-green-600" />,
      title: "Push Notifications",
      description: "Never miss important updates"
    },
    {
      icon: <Shield className="w-6 h-6 text-purple-600" />,
      title: "Secure & Private",
      description: "Your data is protected and secure"
    }
  ];

  const faqs = [
    {
      question: "Is it safe to install?",
      answer: "Yes! Progressive Web Apps are completely secure and don't access your personal data like traditional apps. They run in a protected browser environment."
    },
    {
      question: "How much storage does it use?",
      answer: "Very minimal - typically less than 10MB. Much smaller than traditional apps while providing the same functionality."
    },
    {
      question: "Can I uninstall it easily?",
      answer: "Absolutely! Uninstall ClassSync just like any other app on your device. Long-press the app icon and select remove/uninstall."
    },
    {
      question: "Will it work without internet?",
      answer: "Many features work offline! View cached content, access saved data, and create notes. Everything syncs when you're back online."
    },
    {
      question: "Do I get notifications?",
      answer: "Yes! Once installed, you'll receive push notifications for assignments, announcements, and important class updates."
    },
    {
      question: "What's different from the website?",
      answer: "The installed app offers faster loading, offline access, push notifications, and a native app-like experience with dedicated window/full-screen mode."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">ClassSync</h1>
                <p className="text-xs text-gray-500 hidden sm:block">App Installation Guide</p>
              </div>
            </div>
            <button
              onClick={onBack}
              className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              <span className="hidden sm:inline">Back to Home</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Download className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Install ClassSync App
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Follow our step-by-step guide to install ClassSync on your device.
            Get faster performance, offline access, and push notifications.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {benefits.map((benefit, index) => (
            <div key={index} className="text-center p-4 bg-white rounded-xl border border-gray-200">
              <div className="flex justify-center mb-3">
                {benefit.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">{benefit.title}</h3>
              <p className="text-xs text-gray-600">{benefit.description}</p>
            </div>
          ))}
        </div>

        {/* Platform Selector */}
        <div className="mb-8">
          <div className="flex justify-center">
            <div className="inline-flex bg-white border border-gray-200 rounded-lg p-1">
              {Object.entries(installGuides).map(([key, guide]) => (
                <button
                  key={key}
                  onClick={() => setActiveGuide(key)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeGuide === key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                  <span className="w-4 h-4">
                    {key === 'ios' ? '📱' : key === 'android' ? '🤖' : '💻'}
                  </span>
                  <span className="hidden sm:inline">
                    {key === 'ios' ? 'iPhone/iPad' : key === 'android' ? 'Android' : 'Desktop'}
                  </span>
                  <span className="sm:hidden">
                    {key === 'ios' ? 'iOS' : key === 'android' ? 'Android' : 'PC'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Installation Guide */}
        <div className="mb-12">
          {Object.entries(installGuides).map(([key, guide]) => (
            activeGuide === key && (
              <div key={key} className={`${guide.bgColor} ${guide.borderColor} border rounded-2xl p-6 sm:p-8`}>
                <div className="flex items-center space-x-4 mb-8">
                  {guide.icon}
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{guide.title}</h2>
                    <p className="text-gray-600 mt-1">Follow these simple steps</p>
                  </div>
                </div>

                <div className="grid gap-6">
                  {guide.steps.map((step, index) => (
                    <div key={index} className="flex items-start space-x-4 bg-white rounded-xl p-4 sm:p-6 shadow-sm">
                      <div className={`w-12 h-12 bg-gradient-to-r ${guide.color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
                        {step.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Step {index + 1}: {step.title}
                        </h3>
                        <p className="text-gray-600 leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-white bg-opacity-70 rounded-xl">
                  <div className="flex items-start space-x-3">
                    <div className="text-blue-600 text-xl">💡</div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Pro Tip:</p>
                      <p className="text-sm text-gray-600">
                        {key === 'ios' && "Make sure you're using Safari browser - other browsers don't support PWA installation on iOS."}
                        {key === 'android' && "If you don't see an install prompt, try refreshing the page or checking your browser menu."}
                        {key === 'desktop' && "Look for the install icon in your address bar - it might appear as a download symbol or plus icon."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-8 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 text-center">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-600 text-center mt-2">
              Everything you need to know about installing ClassSync
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {faqs.map((faq, index) => (
              <div key={index} className="px-6 py-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-start">
                  <span className="text-blue-600 mr-2 flex-shrink-0">Q:</span>
                  {faq.question}
                </h3>
                <p className="text-gray-600 leading-relaxed flex items-start">
                  <span className="text-green-600 mr-2 flex-shrink-0">A:</span>
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Need Help Section */}
        <div className="mt-12 text-center">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-200">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🤔</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Still Need Help?</h3>
            <p className="text-gray-600 mb-4">
              Having trouble installing? The browser's built-in install option might be available.
            </p>
            <div className="text-sm text-gray-500">
              Look for install prompts in your browser or contact support if you need assistance.
            </div>
          </div>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-8">
          <button
            onClick={onBack}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            <span>Back to ClassSync</span>
          </button>
        </div>
      </div>
    </div>
  );
};



export default LandingPage;
