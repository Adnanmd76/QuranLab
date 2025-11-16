#!/usr/bin/env node

/**
 * QuranLab MVP Setup Script
 * Initializes database, loads Quranic data, and prepares the environment
 * Usage: node scripts/setup.js [--init-db] [--load-data] [--all]
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const CONFIG = {
  dbPath: path.join(__dirname, '../data/quran_abjad.db'),
  csvPath: path.join(__dirname, '../data/quran_abjad.csv'),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  huggingFaceKey: process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY
};

// Abjad mapping for validation
const ABJAD_MAP = {
  'ا': 1, 'ب': 2, 'ج': 3, 'د': 4, 'ه': 5, 'و': 6, 'ز': 7, 'ح': 8, 'ط': 9,
  'ي': 10, 'ك': 20, 'ل': 30, 'م': 40, 'ن': 50, 'س': 60, 'ع': 70, 'ف': 80,
  'ص': 90, 'ق': 100, 'ر': 200, 'ش': 300, 'ت': 400, 'ث': 500, 'خ': 600,
  'ذ': 700, 'ض': 800, 'ظ': 900, 'غ': 1000
};

class QuranLabSetup {
  constructor() {
    this.db = null;
    this.supabase = null;
    this.args = process.argv.slice(2);
  }

  async init() {
    console.log('🕌 QuranLab MVP Setup Starting...');
    console.log('=' .repeat(50));
    
    try {
      await this.checkEnvironment();
      await this.initializeDatabase();
      
      if (this.args.includes('--load-data') || this.args.includes('--all')) {
        await this.loadQuranData();
      }
      
      if (this.args.includes('--init-db') || this.args.includes('--all')) {
        await this.setupSupabase();
      }
      
      await this.validateSetup();
      
      console.log('\n✅ QuranLab MVP Setup Complete!');
      console.log('🚀 Ready to run: npm run dev');
      
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    } finally {
      if (this.db) {
        this.db.close();
      }
    }
  }

  async checkEnvironment() {
    console.log('🔍 Checking environment...');
    
    // Check Node.js version
    const nodeVersion = process.version;
    console.log(`   Node.js version: ${nodeVersion}`);
    
    // Check required directories
    const dirs = ['data', 'src/components', 'src/pages', 'scripts', 'public'];
    for (const dir of dirs) {
      const dirPath = path.join(__dirname, '..', dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`   Created directory: ${dir}`);
      }
    }
    
    // Check environment variables
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_HUGGINGFACE_API_KEY'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.log('⚠️  Missing environment variables:');
      missingVars.forEach(varName => console.log(`   - ${varName}`));
      console.log('   Please create a .env.local file with these variables.');
    }
    
    console.log('✅ Environment check complete');
  }

  async initializeDatabase() {
    console.log('\n🗄️  Initializing SQLite database...');
    
    // Ensure data directory exists
    const dataDir = path.dirname(CONFIG.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    this.db = new sqlite3.Database(CONFIG.dbPath);
    
    // Create tables
    const createTables = `
      CREATE TABLE IF NOT EXISTS quran_verses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        surah_number INTEGER NOT NULL,
        ayah_number INTEGER NOT NULL,
        arabic_text TEXT NOT NULL,
        english_translation TEXT,
        abjad_value INTEGER,
        tajweed_rules TEXT,
        difficulty_level INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(surah_number, ayah_number)
      );
      
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        session_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS recitation_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        audio_hash TEXT UNIQUE,
        transcript TEXT,
        accuracy REAL,
        abjad_value INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_surah_ayah ON quran_verses(surah_number, ayah_number);
      CREATE INDEX IF NOT EXISTS idx_abjad_value ON quran_verses(abjad_value);
      CREATE INDEX IF NOT EXISTS idx_difficulty ON quran_verses(difficulty_level);
    `;
    
    return new Promise((resolve, reject) => {
      this.db.exec(createTables, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Database tables created successfully');
          resolve();
        }
      });
    });
  }

  async loadQuranData() {
    console.log('\n📖 Loading Quranic data from CSV...');
    
    if (!fs.existsSync(CONFIG.csvPath)) {
      console.log('⚠️  CSV file not found, skipping data load');
      return;
    }
    
    const verses = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(CONFIG.csvPath)
        .pipe(csv())
        .on('data', (row) => {
          // Validate and process each row
          const verse = {
            surah_number: parseInt(row.surah_number),
            ayah_number: parseInt(row.ayah_number),
            arabic_text: row.arabic_text,
            english_translation: row.english_translation,
            abjad_value: parseInt(row.abjad_value) || this.calculateAbjadValue(row.arabic_text),
            tajweed_rules: row.tajweed_rules,
            difficulty_level: parseInt(row.difficulty_level) || 1
          };
          
          verses.push(verse);
        })
        .on('end', async () => {
          try {
            await this.insertVerses(verses);
            console.log(`✅ Loaded ${verses.length} verses into database`);
            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  async insertVerses(verses) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO quran_verses 
      (surah_number, ayah_number, arabic_text, english_translation, abjad_value, tajweed_rules, difficulty_level)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        verses.forEach(verse => {
          stmt.run([
            verse.surah_number,
            verse.ayah_number,
            verse.arabic_text,
            verse.english_translation,
            verse.abjad_value,
            verse.tajweed_rules,
            verse.difficulty_level
          ]);
        });
        
        this.db.run('COMMIT', (err) => {
          if (err) {
            reject(err);
          } else {
            stmt.finalize();
            resolve();
          }
        });
      });
    });
  }

  calculateAbjadValue(text) {
    if (!text) return 0;
    return text.split('').reduce((sum, char) => {
      return sum + (ABJAD_MAP[char] || 0);
    }, 0);
  }

  async setupSupabase() {
    console.log('\n☁️  Setting up Supabase tables...');
    
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
      console.log('⚠️  Supabase credentials not found, skipping cloud setup');
      return;
    }
    
    try {
      this.supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
      
      // Create tables in Supabase (SQL commands)
      const supabaseTables = `
        -- Users progress tracking
        CREATE TABLE IF NOT EXISTS user_progress (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          total_jannah_points INTEGER DEFAULT 0,
          total_recitations INTEGER DEFAULT 0,
          average_accuracy REAL DEFAULT 0,
          current_streak INTEGER DEFAULT 0,
          current_level TEXT DEFAULT 'Learner',
          last_recitation TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Individual recitation records
        CREATE TABLE IF NOT EXISTS recitations (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          surah INTEGER NOT NULL,
          ayah INTEGER NOT NULL,
          transcript TEXT,
          expected_text TEXT,
          accuracy REAL,
          abjad_value INTEGER,
          jannah_points INTEGER,
          tajweed_errors JSONB,
          audio_duration REAL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Hafiz/Qari correction records
        CREATE TABLE IF NOT EXISTS corrections (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          recitation_id UUID REFERENCES recitations(id) ON DELETE CASCADE,
          corrector_id UUID REFERENCES auth.users(id),
          correction_notes TEXT,
          corrected_accuracy REAL,
          bonus_points INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Enable Row Level Security
        ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
        ALTER TABLE recitations ENABLE ROW LEVEL SECURITY;
        ALTER TABLE corrections ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        CREATE POLICY "Users can view own progress" ON user_progress
          FOR SELECT USING (auth.uid() = user_id);
          
        CREATE POLICY "Users can update own progress" ON user_progress
          FOR ALL USING (auth.uid() = user_id);
          
        CREATE POLICY "Users can view own recitations" ON recitations
          FOR SELECT USING (auth.uid() = user_id);
          
        CREATE POLICY "Users can insert own recitations" ON recitations
          FOR INSERT WITH CHECK (auth.uid() = user_id);
      `;
      
      console.log('📋 Supabase table creation SQL generated');
      console.log('   Please run this SQL in your Supabase SQL editor:');
      console.log('   ' + '-'.repeat(50));
      console.log(supabaseTables);
      console.log('   ' + '-'.repeat(50));
      
    } catch (error) {
      console.log('⚠️  Supabase setup error:', error.message);
    }
  }

  async validateSetup() {
    console.log('\n🔍 Validating setup...');
    
    // Check database
    const verseCount = await this.getVerseCount();
    console.log(`   Database: ${verseCount} verses loaded`);
    
    // Check CSV file
    if (fs.existsSync(CONFIG.csvPath)) {
      const csvStats = fs.statSync(CONFIG.csvPath);
      console.log(`   CSV file: ${(csvStats.size / 1024).toFixed(2)} KB`);
    }
    
    // Test Abjad calculation
    const testText = 'بسم الله الرحمن الرحيم';
    const abjadValue = this.calculateAbjadValue(testText);
    console.log(`   Abjad test: "${testText}" = ${abjadValue}`);
    
    // Check environment
    const envStatus = {
      supabase: !!CONFIG.supabaseUrl,
      huggingface: !!CONFIG.huggingFaceKey
    };
    console.log(`   Environment: Supabase ${envStatus.supabase ? '✅' : '❌'}, HuggingFace ${envStatus.huggingface ? '✅' : '❌'}`);
    
    console.log('✅ Validation complete');
  }

  async getVerseCount() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM quran_verses', (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count);
        }
      });
    });
  }

  static showHelp() {
    console.log(`
🕌 QuranLab MVP Setup Script

Usage: node scripts/setup.js [options]

Options:
  --init-db     Initialize database and create tables
  --load-data   Load Quranic data from CSV
  --all         Run all setup steps
  --help        Show this help message

Examples:
  node scripts/setup.js --all
  node scripts/setup.js --init-db --load-data
  node scripts/setup.js

Environment Variables Required:
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  NEXT_PUBLIC_HUGGINGFACE_API_KEY
`);
  }
}

// Main execution
if (require.main === module) {
  const setup = new QuranLabSetup();
  
  if (setup.args.includes('--help')) {
    QuranLabSetup.showHelp();
    process.exit(0);
  }
  
  setup.init().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

module.exports = QuranLabSetup;