import React, { useState } from 'react';
import { Camera, MapPin, AlertCircle, Upload, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function CitizenPage() {
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleUpload = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(true);
      setTimeout(() => navigate('/admin'), 2000); // Route for demo
    }, 1500);
  };

  return (
    <div className="page-container">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card max-w-md mx-auto mt-10 p-8"
      >
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            Report Flood
          </h1>
          <button onClick={() => navigate('/admin')} className="text-sm text-gray-400 hover:text-white transition">Official Login</button>
        </div>

        {success ? (
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="flex flex-col items-center py-10 text-emerald-400"
          >
            <CheckCircle size={64} className="mb-4" />
            <h2 className="text-xl font-bold">Report Submitted!</h2>
            <p className="text-sm text-gray-400 text-center mt-2">Emergency services have been notified.</p>
          </motion.div>
        ) : (
          <form onSubmit={handleUpload} className="flex flex-col gap-6">
            <div className="upload-box group">
              <input 
                type="file" 
                className="hidden" 
                id="photo-upload" 
                onChange={(e) => setFile(e.target.files[0])}
                accept="image/*"
              />
              <label htmlFor="photo-upload" className="flex flex-col items-center gap-2 cursor-pointer p-8 border-2 border-dashed border-gray-600 rounded-xl group-hover:border-indigo-400 group-hover:bg-indigo-500/10 transition-all">
                {file ? (
                  <>
                    <CheckCircle className="text-emerald-400" size={32} />
                    <span className="text-sm text-gray-300">{file.name}</span>
                  </>
                ) : (
                  <>
                    <Camera className="text-gray-400 group-hover:text-indigo-400" size={32} />
                    <span className="text-sm text-gray-400 group-hover:text-indigo-300">Tap to take photo or upload</span>
                  </>
                )}
              </label>
            </div>

            <div className="flex items-center gap-3 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
              <MapPin className="text-blue-400" size={20} />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-200">Current Location automatically fetched</p>
                <p className="text-xs text-gray-400">Park Street, Kolkata</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Additional Details</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl p-4 text-gray-200 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                placeholder="E.g., Water is knee-deep..."
                rows={3}
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting || !file}
              className="mt-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/25"
            >
              {isSubmitting ? <span className="loader"></span> : <><Upload size={20} /> Submit Report</>}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}