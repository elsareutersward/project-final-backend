import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcrypt-nodejs';
import dotenv from 'dotenv';
import cloudinaryFramework from 'cloudinary';
import multer from 'multer';
import cloudinaryStorage from 'multer-storage-cloudinary';

dotenv.config();

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/finalProject"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    minlength: 2,
    unique: true,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  }, 
  password: {
    type: String,
    minlength: 6,
    required: true,
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString('hex'),
  }, 
});

const AdSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  info: {
    type: String,
    required: true, 
  },  
  price: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
  },
  location: {
    type: String,
  },
  delivery: {
    type: String, 
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
  }, 
}); 

const ConversationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  adId: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ad',
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
  },
  status: {
    type: Number,
    default: 1,
  }
});

const MessageSchema = mongoose.Schema({
  message: {
    type: String,
    required: true, 
    minlength: 1,
    maxlength: 140
  },
  name: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
  },
  conversation: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Conversation',
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
  }
});

let User = mongoose.model('User', UserSchema);
let Ad = mongoose.model('Ad', AdSchema);
let Conversation = mongoose.model('Conversation', ConversationSchema);
let Message = mongoose.model('Message', MessageSchema);

const cloudinary = cloudinaryFramework.v2; 
cloudinary.config({
  cloud_name: 'elsascloudinary',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = cloudinaryStorage({
  cloudinary,
  params: {
    folder: 'images',
    allowedFormats: ['jpg', 'png'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }],
  },
});
const parser = multer({ storage });

const authenticateUser = async (req, res, next) => {
  try {
    const user = await User.findOne({ accessToken: req.header("Authorization") });
    if (user) {
      req.user = user;
      next();
    } else {
      res.status(401).json({ loggedOut: true, message: 'Please try logging in' });
    }
  } catch (err) {
    res.status(403).json({ message: 'Access token is missing or wrong', errors: err })
  }
};

const port = process.env.PORT || 8080;
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    next();
  } else {
    res.status(503).json({ error: 'Service unavailable' });
  };
});

// Endpoints for User

app.post('/users/create', async (req, res) => {
  try {
    const {name, email, password} = req.body;
    const user = new User({name, email, password: bcrypt.hashSync(password)});
    await user.save();
    res.json({ userId: user._id, accessToken: user.accessToken, userName: user.name });
  } catch (err) {
    res.status(400).json({ message: 'Could not create user', errors: err.errors });
  }
});

app.post('/sessions', async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user && bcrypt.compareSync(req.body.password, user.password)) {
    res.json({ userId: user._id, accessToken: user.accessToken, userName: user.name });
  } else {
    res.status(401).json({ notFound: true, error: 'Login failed' });
  }
});

app.get('/seller/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const seller = await User.findOne({ _id: id });
    return res.json({ sellerName: seller.name })
  } catch (err) {
    res.status(404).json({error: 'Did not find seller', error:err })
  }
})

//Endpoints for Ad

app.get('/posts', async (req, res) => {
  try {
    const { id, userId } = req.query
    if (id) {
      const ad = await Ad.findOne({ _id: id }).populate('seller');
      const response = {
        info: ad.info,
        price: ad.price,
        sellerId: ad.seller._id,
        title: ad.title,
        image: ad.imageUrl,
        location: ad.location,
        delivery: ad.delivery,
        sellerName: ad.seller.name,
        id: ad._id,
        createdAt: ad.createdAt
      }
      return res.json(response)
    } 
    if (userId) {
      const sellersAds = await Ad.find({ seller: mongoose.Types.ObjectId(userId)})
      return res.json(sellersAds)
    }
    const ads = await Ad.find().sort({createdAt: 'desc'});
    res.json(ads);
  } catch (err) {
    res.status(404).json({error: 'Did not find product', error:err })
  }
});

app.post('/posts', authenticateUser);
app.post('/posts', parser.single('image'), async (req, res) => {
  try {
    const { title, info, price, category, location, delivery, seller } = req.body;
    const ad = new Ad({ 
      title, 
      info, 
      price, 
      category, 
      location, 
      delivery, 
      imageUrl: req.file.path, 
      imageId: req.file.filename,
      seller
    });
    await ad.save();
    res.json(ad);
  } catch (err) {
    res.status(400).json({
      error: 'Could not save ad to the Database',
      errors: err.errors
    });
  }
});

app.delete('/posts', authenticateUser);
app.delete('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params; 
    await Ad.deleteOne({ _id: id });
    res.sendStatus(200);
  } catch (err) {
    console.error('hej', err);
    res.status(404).json({
      error: 'Could not delete post',
      errors: err.errors
    });
  }
});

// Endpoints Conversation and Message

app.post('/conversation', authenticateUser);
app.post('/conversation', async (req, res) => {
  try {
    const { name, adId, sellerId, buyerId } = req.body;
    const conversation = new Conversation({ name, adId, sellerId, buyerId });
    await conversation.save();
    res.json(conversation);
  } catch (err) {
    res.status(400).json({
      error: 'Could not create conversation',
      errors: err.errors
    });
  }
});

app.post('/message', authenticateUser);
app.post('/message', async (req, res) => {
  try {
    const { message, name, conversation } = req.body;
    const conversationMessage = new Message({ message, name, conversation });
    await conversationMessage.save();
    res.sendStatus(200);
  } catch (err) {
    res.status(400).json({
      error: 'Could not create conversation',
      errors: err.errors
    });
  }
});

app.get('/conversations', authenticateUser);
app.get('/conversations', async (req, res) => {
  try {
    const { userId } = req.query;
    const sellerConversations = await Conversation.find({ 
      sellerId: mongoose.Types.ObjectId(userId)
    }).populate('buyerId').populate('adId')
    const buyerConversations = await Conversation.find({ 
      buyerId: mongoose.Types.ObjectId(userId)
    }).populate('sellerId').populate('adId')
    return res.json({sellerConversations, buyerConversations});
  } catch (err) {
    res.status(404).json({error: 'Did not find any conversations', error:err });
  }
});

app.get('/conversation/:id', authenticateUser);
app.get('/conversation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conversationInfo = await Conversation.findOne({ _id: id }).populate('adId');
    const info = {
      title: conversationInfo.name, 
      image: conversationInfo.adId.imageUrl,
      price: conversationInfo.adId.price,
      location: conversationInfo.adId.location,
      delivery: conversationInfo.adId.delivery,
    };
    const conversationMessages = await Message.find({ 
      conversation: mongoose.Types.ObjectId(id)
    }).populate('name');
    const messages = conversationMessages.map(message =>
      ({message: message.message,
      name: message.name.name,
      createdAt: message.createdAt})
    );
    return res.json({ info, messages });
  } catch (err) {
    res.status(404).json({error: 'Did not find conversation', error:err });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});