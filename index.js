const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SK);


// middleware
app.use(express.json());
app.use(cors({
   origin: ['http://localhost:5173', 'https://surveywave-5b379.web.app'],
   credentials: true,
}))

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.f8d3p09.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
   serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
   }
});


async function run() {
   try {
      // Connect the client to the server	(optional starting in v4.7)
      // await client.connect();  
      const surveyCollection = client.db("SurveyWave").collection("surveys");
      const userCollection = client.db("SurveyWave").collection("users");


      // jwt related api
      app.post('/jwt', async (req, res) => {
         const user = req.body;
         const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
            expiresIn: '2h'
         })
         res.send({ token })
      })

      // middleware
      const verifyToken = (req, res, next) => {
         // console.log(req.headers)
         if (!req.headers.authorization) {
            // console.log('this is from err block on line 50')
            return res.status(401).send({ message: 'unAuthorized Access' })
         }
         const token = req.headers.authorization.split(' ')[1];
         // console.log('token from middleware', token)
         jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
            if (err) {
               return res.status(401).send({ message: 'unAuthorized Access' })
            }
            req.decoded = decoded;
            next();
         })
      }

      const verifyAdmin = async (req, res, next) => {
         const email = req.decoded.email;
         const query = { email: email };
         const user = await userCollection.findOne(query);
         const isAdmin = user?.role === 'admin';
         if (!isAdmin) {
            return res.status(403).send({ message: 'forbidden access from admin' })
         }
         next();
      }


      // user related api
      app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
         const result = await userCollection.find().toArray();
         res.send(result);
      })

      app.post('/users', async (req, res) => {
         const user = req.body;
         const query = { email: user?.email };
         const existingUser = await userCollection.findOne(query);
         if (existingUser) {
            return res.send({ message: 'user exist', insertedId: null })
         }
         const result = await userCollection.insertOne(user);
         res.send(result);
      })
      // make admin
      app.patch('/users/admin/:id', async (req, res) => {
         const id = req.params.id;
         // console.log('api hitted', id);
         const filter = { _id: new ObjectId(id) };
         const updatedDoc = {
            $set: {
               role: 'admin'
            }
         }
         const result = await userCollection.updateOne(filter, updatedDoc);
         res.send(result);
      })


      // isAdmin
      app.get('/users/admin/:email', verifyToken, verifyAdmin, async (req, res) => {
         const email = req.params.email;
         if (email !== req.decoded.email) {
            return res.status(403).send('forbidden access')
         }
         const query = { email: email };
         const user = await userCollection.findOne(query);
         let admin = false;
         if (user) {
            admin = user?.role === 'admin'
         }
         res.send({ admin })
      })


      // survey related apis
      app.get('/surveys', async (req, res) => {
         const total = await surveyCollection.find().toArray();
         res.send(total);
      })

      app.get('/surveys/details/:id', async (req, res) => {
         const id = req.params.id;
         const query = { _id: new ObjectId(id) };
         const result = await surveyCollection.findOne(query);
         res.send(result);
      })


      // paymetn intent apis
      app.post('/create-payment-intent', async (req, res) => {
         const { price } = req.body;
         const amount = parseInt(price * 100);

         const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            payment_method_types: ['card']
         })

         res.send({
            clientSecret: paymentIntent.client_secret
         })
      });

      res.send({
         clientSecret: paymentIntent.client_secret,
      });


      // Send a ping to confirm a successful connection
      // await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
   } finally {
      // Ensures that the client will close when you finish/error
      // await client.close();
   }
}
run().catch(console.dir);


app.get('/', (req, res) => {
   res.send('surveyWave server is running')
})

app.listen(port, () => {
   console.log(`surveyWave server is running on port: ${port}`)
})