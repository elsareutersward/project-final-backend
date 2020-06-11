import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcrypt-nodejs';

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/finalProject"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise

const User = mongoose.model('User', {
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
  }
});

const Ad = mongoose.model('Ad', {
  title: {
    type: String,
    minlength: 5,
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
  seller: {
    type: String,
    required: true,
  },
  sold: {
    type: Boolean, 
    default: false,
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
  }, 
}); 

/* if (process.env.RESET_DATABASE) {
  const seedDatabase = async () => {
    await Ad.deleteMany();
    await Ad.forEach((ad) => {
      new Ad(ad).save();
    });
  };
  seedDatabase();
}; */

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

// Endpoints for user

app.post('/users/create', async (req, res) => {
  try {
    const {name, email, password} = req.body;
    const user = new User({name, email, password: bcrypt.hashSync(password)});
    await user.save();
    res.status(201);
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

app.get('/users/:id', authenticateUser);
app.get('/users/:id', async (req, res) => {
  //user information
  res.status(201).json({ secretMessage });
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

//Endpoints for ad

// HELPERS
const getAdWithSellerName = async (ad) => {
  const seller = await User.findOne({ _id: ad.seller });
  return {
    info: ad.info,
    price: ad.price,
    sellerId: ad.seller,
    sold: ad.sold,
    title: ad.title,
    sellerName: seller.name,
    id: ad._id,
    createdAt: ad.createdAt
  };
}

const getAdsWithSellerNames = async (ads) => {
  return await Promise.all(ads.map(async ad =>
    getAdWithSellerName(ad)
  ));
}

app.get('/posts', async (req, res) => {
  try {
    const { id, userId } = req.query
    if (id) {
      const ad = await Ad.findOne({ _id: id });
      const adWithSellerName = await getAdWithSellerName(ad);
      return res.json(adWithSellerName)
    } 
    if (userId) {
      const sellerAds = await Ad.find({ seller: userId });
      const sellerAdsWithNames = await getAdsWithSellerNames(sellerAds);
      return res.json(sellerAdsWithNames)
    }
    const ads = await Ad.find().sort({createdAt: 'desc'});
    const adsWithSellerNames = await getAdsWithSellerNames(ads);

    res.json(adsWithSellerNames);
  } catch (err) {
    res.status(404).json({error: 'Did not find product', error:err })
  }
});

app.post('/posts', authenticateUser);
app.post('/posts', async (req, res) => {
  try {
    const { title, info, price, category, location, delivery, image, seller } = req.body;
    const ad = new Ad({ title, info, price, category, location, delivery, image, seller });
    await ad.save();
    console.log(ad._id)
    console.log(ad)
    res.json(ad);
  } catch (err) {
    res.status(400).json({
      error: 'Could not save ad to the Database',
      errors: err.errors
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});