import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from 'pg';

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "MyShow",
    password: "pw", //change pw here
    port: 5432,
  });

const app = express();
const port = 3000;
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
let currentUser = ['nope', -1];

//main page
app.get("/", (req, res) => {
    res.render('main.ejs', {currentUser: currentUser});
});

//page to create new user profile
app.get("/addprofile", (req, res) => {
    res.render('main.ejs', {newChecker: true});
});

//login route
app.post('/login', async(req, res) => {
    let enteredEmail = req.body.email;
    console.log(enteredEmail + "= entered email")
    let enteredPw = req.body.pw;
    //checks for user email in the db
    try {
        let emailSearch = await db.query("SELECT * FROM users WHERE email=$1", [enteredEmail]);
    }
    catch(error) {
        console.log(error)
        res.render('main.ejs', {loginError: "This user does not exist. Please, check the email or create a new profile"});
    }
    //verifying the password
    try {
        let pwSearch = await db.query('SELECT pw FROM users WHERE email=$1', [enteredEmail]);
        let resultPW = pwSearch.rows[0].pw;
        if (resultPW === enteredPw) {
            let UN = await db.query('SELECT * FROM users WHERE email=$1', [enteredEmail])
            currentUser[0] = UN.rows[0].name;
            currentUser[1] = UN.rows[0].id;
            res.render('myshow.ejs', {currentUser: currentUser, checker:true});

        } else {
            res.render('main.ejs', {loginError: "Password is incorrect for your profile"});
        } 
    }
    catch(error) {
        console.log(error)
        res.render('main.ejs', {loginError: "Sorry, we run into an issue. Try again later"});
    }
});

//logout route
app.get("/logout", (req, res) => {
    currentUser = ['nope', -1];
    res.render('main.ejs', {currentUser: currentUser});
}); 

//adding new user to the db
app.post("/signup", async(req, res) => {
    let enteredData = [req.body.email, req.body.name, req.body.pw1, req.body.pw2];
    //verifying that entered data is correct
    if (enteredData[2] !== enteredData[3]) {
        console.log(enteredData);
        res.render('main.ejs', {newChecker: true, loginError: "Passwords do not match"})
    }
    enteredData.splice(-1);
    //adding user to the db + auto login
    try {
        await db.query("INSERT INTO users (email, name, pw) VALUES ($1, $2, $3)", enteredData);
        let search = await db.query("SELECT * FROM users WHERE email=$1", [enteredData[0]]);
        currentUser = [search.rows[0].name, search.rows[0].id];
        res.render('main.ejs', {currentUser: currentUser});
    }
    catch(error) {
        console.log(error)
        res.render('main.ejs', {newChecker: true, loginError: "We ran into an issue. Please, try again later"})
    }
 
}); 

//main shows page
app.get("/show", (req, res) => {
    res.render('myshow.ejs', {checker: true, currentUser: currentUser});
});

//showing the search results
app.post("/shows", async(req, res) => {
    try {
        let enteredShow = req.body['show'];
        //using API to get the array of tv shows related to inputted data
        let result = await axios(`https://api.tvmaze.com/search/shows?q=${enteredShow}`);
        //checking if the shows are added to user's db to later change the "Add to list"/"Delete" btn
        if (result.data.length > 0) {
            let dbSearch = await db.query('SELECT * FROM shows WHERE user_id=$1', [currentUser[1]]);
            let dbResult = dbSearch.rows;
            let idArray = [];
            dbResult.forEach((element) => {idArray.push(element.showid)});
            res.render("myshow.ejs", {content: result.data, searchedData: enteredShow, idArray: idArray, currentUser: currentUser});
        } else {
            res.render("myshow.ejs", {error: "Sorry, we couldn't find this show!", currentUser: currentUser});
        }
    }
    catch (error) {
        console.error(error);
        res.render("myshow.ejs", {error: "Sorry, we are having issues! Please, try again later", currentUser: currentUser});
    }
});

//showing data for specific show
app.post('/details', async(req,res) => {
    let someId = req.body['chosenShow'].split(',');
    console.log(someId);
    let chosenShow;
    //using different API methods depending on the show's id type
    switch (someId[0]) {
        case 'tvrage':
           chosenShow = await axios(`https://api.tvmaze.com/lookup/shows?tvrage=${someId[1]}`);
        break;
        case 'imdb':
            chosenShow = await axios(`https://api.tvmaze.com/lookup/shows?imdb=${someId[1]}`);
        break;
        case 'thetvdb':
          chosenShow = await axios(`https://api.tvmaze.com/lookup/shows?thetvdb=${someId[1]}`);
        break;
        case 'name':
            chosenShow = await axios(`https://api.tvmaze.com/singlesearch/shows?q=${someId[1]}`);
        break;
        default:
            console.log('error with finding specific show')
            res.render("myshow.ejs", {error: "Sorry, we have issues accessing this show. Please, try again later", currentUser: currentUser});
    } 
    //checking if the chosen show is in user's list db to switch "Add to list" btn
    let dbSearch = await db.query('SELECT * FROM shows WHERE user_id=$1', [currentUser[1]]);
    let dbResult = dbSearch.rows;
    let idArray = [];
    dbResult.forEach((element) => {idArray.push(element.showid)});


    res.render("myshow.ejs", {show: chosenShow.data, idArray: idArray, currentUser: currentUser});
});
//route for adding shows to the user's list
app.post('/addToShowList', async (req,res) => {
    //requires login
    if (currentUser[1] == -1) {
        res.render('myshow.ejs', {error: "Log In to add shows to your list"})
    }

    let showInfo = req.body['addToList'];
    showInfo = showInfo.split(',');
    let result = 0;
    let search = 0;
    //getting the search data that was entered to redirect to the previous page after adding
    if (showInfo.length === 6) {
        search = showInfo.splice(-1);
        result = await axios(`https://api.tvmaze.com/search/shows?q=${search[0]}`);
    }
    //checking if the show has already been added to th edb for the user
    showInfo.push(currentUser[1]);
    let dbSearch = await db.query('SELECT * FROM shows WHERE user_id=$1', [currentUser[1]]);
    let dbResult = dbSearch.rows;
    let idArray = [];
    dbResult.forEach((element) => {idArray.push(element.showid)});
    //adding to the show to the user's list
    try {
        await db.query("INSERT INTO shows (showid, name, url, idname, idvalue, user_id) VALUES ($1, $2, $3, $4, $5, $6)", showInfo);
        idArray.push(showInfo[0]);
        if (search[0] == 0) {
            res.render('myshow.ejs', {error: `${showInfo[1]} has been added to your list`, currentUser: currentUser, idArray: idArray});
        }
        //rendering the same show's details page if the show was added from details
        else if (search[0] == 1) {
            let chosenShow;
            let someId = [showInfo[3], showInfo[4]];

            switch (someId[0]) {
                case 'tvrage':
                   chosenShow = await axios(`https://api.tvmaze.com/lookup/shows?tvrage=${someId[1]}`);
                break;
                case 'imdb':
                    chosenShow = await axios(`https://api.tvmaze.com/lookup/shows?imdb=${someId[1]}`);
                break;
                case 'thetvdb':
                  chosenShow = await axios(`https://api.tvmaze.com/lookup/shows?thetvdb=${someId[1]}`);
                break;
                case 'name':
                    chosenShow = await axios(`https://api.tvmaze.com/singlesearch/shows?q=${someId[1]}`);
                break;
                default:
                    console.log('error with finding specific show')
                    res.render("myshow.ejs", {error: "Sorry, we have issues adding this show. Please, try again later", currentUser: currentUser, idArray: idArray});
            } 
            res.render("myshow.ejs", {show: chosenShow.data, error: `"${showInfo[1]}" has been added to your list`, currentUser: currentUser, idArray: idArray});
        }
        else {
        res.render("myshow.ejs", {content: result.data, searchedData: search[0], error: `"${showInfo[1]}" has been added to your list`, currentUser: currentUser, idArray: idArray});
        }
    }
    catch(error) {
        if (search === 0) {
            console.log('error with PG = '+ error);
            res.render("myshow.ejs", {error: `${showInfo[1]} has already been added to your list`, currentUser: currentUser});
        }
        res.render("myshow.ejs", {content: result.data, error: `${showInfo[1]} has already been added to your list`, currentUser: currentUser});
    }
});
//user's list + authorization check
app.get('/myShowList', async (req,res) => {
    let search = await db.query("SELECT * FROM shows WHERE user_id=$1", [currentUser[1]])
    let result = search.rows;
    if (result.length === 0) {
        res.render('list.ejs', {error: true, currentUser: currentUser})
    }
    res.render('list.ejs', {content: result, currentUser: currentUser})

});
//deleting show from from the user's list, details tab and shows tab
app.post('/delete', async (req,res) => { 
    let id = req.body['removeFromList'];
    id = id.split(',');
    await db.query("DELETE FROM shows WHERE showid=$1 AND user_id=$2", [id[0], currentUser[1]]);
    let search = await db.query("SELECT * FROM shows WHERE user_id=$1", [currentUser[1]])
    let result = search.rows;
    if (result.length === 0) {
        res.render('list.ejs', {error: true, currentUser: currentUser})
    }
    res.render('list.ejs', {content: result, message:`${id[1]} has been removed from your list`, currentUser: currentUser})
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });