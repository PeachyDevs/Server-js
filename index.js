const express = require("express");

const app = express();
const PORT = 5000

// Middlewares
app.use(express.json())

// Routes
app.get('/', (req, res) => {
	res.send('Server is running')
})

app.get('/api/test', (req, res) => {
	res.json({ message: 'API is working'})
})


// 404 
app.all('*', (req, res) => {
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