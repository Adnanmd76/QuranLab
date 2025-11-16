import React, { useState, useRef, useEffect } from 'react';
import { HfInference } from '@huggingface/inference';
import { supabase } from '../lib/supabase';
import AbjadValidator from './AbjadValidator';
import JannahPoints from './JannahPoints';

const RecitationAnalyzer = () => {
  const [audioFile, setAudioFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [accuracy, setAccuracy] = useState(0);
  const [abjadValue, setAbjadValue] = useState(0);
  const [jannahPoints, setJannahPoints] = useState(0);
  const [tajweedErrors, setTajweedErrors] = useState([]);
  const [currentAyah, setCurrentAyah] = useState({ surah: 1, ayah: 1 });
  const [expectedText, setExpectedText] = useState('');
  const [user, setUser] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  
  // Hugging Face client
  const hf = new HfInference(process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY);
  
  // Abjad mapping for Arabic letters
  const abjadMap = {
    'ا': 1, 'ب': 2, 'ج': 3, 'د': 4, 'ه': 5, 'و': 6, 'ز': 7, 'ح': 8, 'ط': 9,
    'ي': 10, 'ك': 20, 'ل': 30, 'م': 40, 'ن': 50, 'س': 60, 'ع': 70, 'ف': 80,
    'ص': 90, 'ق': 100, 'ر': 200, 'ش': 300, 'ت': 400, 'ث': 500, 'خ': 600,
    'ذ': 700, 'ض': 800, 'ظ': 900, 'غ': 1000
  };
  
  useEffect(() => {
    // Get current user
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getCurrentUser();
    
    // Load expected text for current ayah
    loadExpectedText();
  }, [currentAyah]);
  
  const loadExpectedText = async () => {
    try {
      // In a real implementation, this would fetch from your Quran database
      const quranData = {
        '1:1': 'بِسمِ اللهِ الرَحمٰنِ الرَحِيمِ',
        '1:2': 'الحَمدُ لِلهِ رَبِّ العَالَمِينَ',
        '1:3': 'الرَحمٰنِ الرَحِيمِ'
      };
      
      const ayahKey = `${currentAyah.surah}:${currentAyah.ayah}`;
      setExpectedText(quranData[ayahKey] || '');
    } catch (error) {
      console.error('Error loading expected text:', error);
    }
  };
  
  const calculateAbjadValue = (text) => {
    return text.split('').reduce((sum, char) => {
      return sum + (abjadMap[char] || 0);
    }, 0);
  };
  
  const calculateAccuracy = (expected, actual) => {
    if (!expected || !actual) return 0;
    
    const expectedChars = expected.replace(/\s/g, '').split('');
    const actualChars = actual.replace(/\s/g, '').split('');
    
    let matches = 0;
    const minLength = Math.min(expectedChars.length, actualChars.length);
    
    for (let i = 0; i < minLength; i++) {
      if (expectedChars[i] === actualChars[i]) {
        matches++;
      }
    }
    
    return Math.round((matches / expectedChars.length) * 100);
  };
  
  const calculateJannahPoints = (accuracy, abjadValue) => {
    const basePoints = Math.floor(accuracy * 10);
    const abjadBonus = Math.floor(abjadValue / 100);
    const perfectionBonus = accuracy >= 95 ? 500 : 0;
    return basePoints + abjadBonus + perfectionBonus;
  };
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioFile(audioBlob);
        analyzeAudio(audioBlob);
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Error accessing microphone. Please check permissions.');
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop all tracks to release microphone
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };
  
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setAudioFile(file);
      analyzeAudio(file);
    }
  };
  
  const analyzeAudio = async (audioFile) => {
    if (!audioFile) return;
    
    setIsAnalyzing(true);
    
    try {
      // Convert audio to text using Hugging Face ASR
      const result = await hf.automaticSpeechRecognition({
        model: 'openai/whisper-large-v3',
        data: audioFile
      });
      
      const transcribedText = result.text || '';
      setTranscript(transcribedText);
      
      // Calculate Abjad value
      const abjad = calculateAbjadValue(transcribedText);
      setAbjadValue(abjad);
      
      // Calculate accuracy
      const accuracyScore = calculateAccuracy(expectedText, transcribedText);
      setAccuracy(accuracyScore);
      
      // Calculate Jannah Points
      const points = calculateJannahPoints(accuracyScore, abjad);
      setJannahPoints(points);
      
      // Analyze Tajweed (simplified version)
      const errors = analyzeTajweed(transcribedText, expectedText);
      setTajweedErrors(errors);
      
      // Save to database
      if (user) {
        await saveRecitationRecord({
          user_id: user.id,
          surah: currentAyah.surah,
          ayah: currentAyah.ayah,
          transcript: transcribedText,
          expected_text: expectedText,
          accuracy: accuracyScore,
          abjad_value: abjad,
          jannah_points: points,
          tajweed_errors: errors
        });
      }
      
    } catch (error) {
      console.error('Error analyzing audio:', error);
      alert('Error analyzing audio. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const analyzeTajweed = (actual, expected) => {
    // Simplified Tajweed analysis
    const errors = [];
    
    // Check for common Tajweed rules
    const tajweedRules = [
      { rule: 'Madd', pattern: /[اوي]/, description: 'Elongation rules' },
      { rule: 'Ghunnah', pattern: /[من]/, description: 'Nasal sound rules' },
      { rule: 'Qalqalah', pattern: /[قطبجد]/, description: 'Echoing rules' },
      { rule: 'Idgham', pattern: /ن[ملنريو]/, description: 'Merging rules' }
    ];
    
    tajweedRules.forEach(rule => {
      if (rule.pattern.test(expected) && !rule.pattern.test(actual)) {
        errors.push({
          rule: rule.rule,
          description: rule.description,
          severity: 'medium'
        });
      }
    });
    
    return errors;
  };
  
  const saveRecitationRecord = async (record) => {
    try {
      const { error } = await supabase
        .from('recitations')
        .insert([record]);
      
      if (error) throw error;
      
      // Update user's total Jannah Points
      const { error: updateError } = await supabase
        .from('user_progress')
        .upsert({
          user_id: record.user_id,
          total_jannah_points: jannahPoints,
          last_recitation: new Date().toISOString()
        });
      
      if (updateError) throw updateError;
      
    } catch (error) {
      console.error('Error saving recitation:', error);
    }
  };
  
  const resetAnalysis = () => {
    setAudioFile(null);
    setTranscript('');
    setAccuracy(0);
    setAbjadValue(0);
    setJannahPoints(0);
    setTajweedErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  return (
    <div className="recitation-analyzer">
      <div className="analyzer-header">
        <h2>🕌 Quranic Recitation Analyzer</h2>
        <div className="ayah-selector">
          <label>Current Ayah:</label>
          <select 
            value={`${currentAyah.surah}:${currentAyah.ayah}`}
            onChange={(e) => {
              const [surah, ayah] = e.target.value.split(':');
              setCurrentAyah({ surah: parseInt(surah), ayah: parseInt(ayah) });
            }}
          >
            <option value="1:1">Al-Fatiha 1:1</option>
            <option value="1:2">Al-Fatiha 1:2</option>
            <option value="1:3">Al-Fatiha 1:3</option>
          </select>
        </div>
      </div>
      
      <div className="expected-text">
        <h3>Expected Text:</h3>
        <div className="arabic-text">{expectedText}</div>
      </div>
      
      <div className="recording-controls">
        <div className="record-section">
          <button 
            onClick={isRecording ? stopRecording : startRecording}
            className={`record-btn ${isRecording ? 'recording' : ''}`}
            disabled={isAnalyzing}
          >
            {isRecording ? '⏹️ Stop Recording' : '🎤 Start Recording'}
          </button>
        </div>
        
        <div className="upload-section">
          <input 
            type="file" 
            accept="audio/*" 
            onChange={handleFileUpload}
            ref={fileInputRef}
            disabled={isAnalyzing}
          />
          <label>Or upload an audio file</label>
        </div>
      </div>
      
      {isAnalyzing && (
        <div className="analyzing">
          <div className="spinner"></div>
          <p>Analyzing your recitation...</p>
        </div>
      )}
      
      {transcript && (
        <div className="results">
          <div className="transcript-section">
            <h3>Your Recitation:</h3>
            <div className="arabic-text transcript">{transcript}</div>
          </div>
          
          <div className="metrics">
            <div className="accuracy-meter">
              <h4>Accuracy: {accuracy}%</h4>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${accuracy}%` }}
                ></div>
              </div>
            </div>
            
            <AbjadValidator 
              text={transcript} 
              expectedValue={calculateAbjadValue(expectedText)}
              actualValue={abjadValue}
            />
            
            <JannahPoints 
              points={jannahPoints}
              accuracy={accuracy}
              abjadValue={abjadValue}
            />
          </div>
          
          {tajweedErrors.length > 0 && (
            <div className="tajweed-errors">
              <h4>Tajweed Observations:</h4>
              <ul>
                {tajweedErrors.map((error, index) => (
                  <li key={index} className={`error-${error.severity}`}>
                    <strong>{error.rule}:</strong> {error.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="actions">
            <button onClick={resetAnalysis} className="reset-btn">
              🔄 Try Again
            </button>
            <button 
              onClick={() => setCurrentAyah(prev => ({ ...prev, ayah: prev.ayah + 1 }))}
              className="next-btn"
            >
              ➡️ Next Ayah
            </button>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .recitation-analyzer {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Arial', sans-serif;
        }
        
        .analyzer-header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .ayah-selector {
          margin-top: 15px;
        }
        
        .ayah-selector select {
          padding: 8px 15px;
          font-size: 16px;
          border-radius: 5px;
          border: 1px solid #ddd;
        }
        
        .expected-text {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 10px;
          margin-bottom: 20px;
          text-align: center;
        }
        
        .arabic-text {
          font-size: 24px;
          font-family: 'Amiri', 'Times New Roman', serif;
          line-height: 1.8;
          direction: rtl;
          color: #2c3e50;
        }
        
        .recording-controls {
          display: flex;
          gap: 20px;
          justify-content: center;
          align-items: center;
          margin: 30px 0;
          flex-wrap: wrap;
        }
        
        .record-btn {
          padding: 15px 30px;
          font-size: 18px;
          border: none;
          border-radius: 25px;
          background: #27ae60;
          color: white;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .record-btn:hover {
          background: #219a52;
          transform: translateY(-2px);
        }
        
        .record-btn.recording {
          background: #e74c3c;
          animation: pulse 1s infinite;
        }
        
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        
        .analyzing {
          text-align: center;
          padding: 40px;
        }
        
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .results {
          margin-top: 30px;
        }
        
        .transcript-section {
          background: #e8f5e8;
          padding: 20px;
          border-radius: 10px;
          margin-bottom: 20px;
        }
        
        .metrics {
          display: grid;
          gap: 20px;
          margin: 20px 0;
        }
        
        .accuracy-meter h4 {
          margin-bottom: 10px;
          color: #2c3e50;
        }
        
        .progress-bar {
          width: 100%;
          height: 20px;
          background: #ecf0f1;
          border-radius: 10px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #e74c3c 0%, #f39c12 50%, #27ae60 100%);
          transition: width 0.5s ease;
        }
        
        .tajweed-errors {
          background: #fff3cd;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #ffc107;
          margin: 20px 0;
        }
        
        .tajweed-errors ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        
        .error-medium {
          color: #856404;
        }
        
        .actions {
          display: flex;
          gap: 15px;
          justify-content: center;
          margin-top: 30px;
        }
        
        .reset-btn, .next-btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .reset-btn {
          background: #6c757d;
          color: white;
        }
        
        .next-btn {
          background: #007bff;
          color: white;
        }
        
        .reset-btn:hover, .next-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
};

export default RecitationAnalyzer;