import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [20, 'Username cannot exceed 20 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [50, 'Full name cannot exceed 50 characters']
  },
  chessRating: {
    type: Number,
    default: 1200,
    min: [0, 'Rating cannot be negative'],
    max: [3000, 'Rating cannot exceed 3000']
  },
  gamesPlayed: {
    type: Number,
    default: 0,
    min: [0, 'Games played cannot be negative']
  },
  gamesWon: {
    type: Number,
    default: 0,
    min: [0, 'Games won cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get user stats
userSchema.methods.getStats = function() {
  return {
    gamesPlayed: this.gamesPlayed,
    gamesWon: this.gamesWon,
    winRate: this.gamesPlayed > 0 ? ((this.gamesWon / this.gamesPlayed) * 100).toFixed(1) : 0,
    chessRating: this.chessRating
  };
};

export default mongoose.model('User', userSchema);