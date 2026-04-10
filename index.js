require('dotenv').config()
const path = require('path')
const express = require("express");
const app = express();
const cors = require('cors')
const corsOptions = require('./config/corsOptions')
const connectDB = require('./config/dbConnex.js')
const { 
    logger, 
    logEvents 
} = require('./middlewares/logger')

const PORT = process.env.PORT || 3500

console.log(process.env.NODE_ENV)

// connectDB()

app.use(logger)

app.use(cors(corsOptions))

app.use(express.json())

// Routes
app.use('/', require('./routes/root'))
// app.use('/auth', require('./routes/authRoutes'))
app.use('/student', require('./routes/studentRoutes'))

app.get('/api/test', (req, res) => {
	res.json({ message: 'API is working'})
})


// 404 
app.all(/.*/, (req, res) => {
    res.status(404)
    if (req.accepts('html')) {
        res.sendFile(path.join(__dirname, 'views', '404.html'))
    } else if (req.accepts('json')) {
        res.json({ message: '404 Not Found' })
    } else {
        res.type('txt').send('404 Not Found')
    }
})


// Server 
app.listen(PORT, () => {
	console.log(`\n Server is running on http://localhost:${PORT}`)
})