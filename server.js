import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mongoose from 'mongoose';

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/happyThoughts"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise

const Ad = mongoose.model('Ad', {

});

if (process.env.RESET_DATABASE) {
  const seedDatabase = async () => {
    await Ad.deleteMany();
    await Ad.forEach((ad) => {
      new Ad(ad).save();
    });
  };
  seedDatabase();
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

app.get('/', async (req, res) => {
  const ads = await Ad.find()
    .sort({createdAt: 'desc'})
  res.json(ads);
});

app.post('/', async (req, res) => {
  try {
    const {  } = req.body;
    const ad = new Ad({  })
    const savedAd = await ad.save();
    res.status(200).json(savedAd);
  } catch (err) {
    res.status(400).json({error: 'Could not save ad to the Database', errors:err.errors});
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});