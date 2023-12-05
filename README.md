# MyShow
project to search for tv shows and add those to your user's list. Multiple users with authorization

Requirements: Postgres/pgAdmin = 3 tables

1. Clone the files
2. Download and create acc for pgAdmin
3. in pgAdmin crete new db called 'MyShow'
4. for the MyShow db create table users > code:
  CREATE TABLE users( id SERIAL PRIMARY KEY, name TEXT, email text UNIQUE);

5. for the MyShow db create table 'shows' > code:
  CREATE TABLE shows ( mainid SERIAL PRIMARY KEY, showid INT NOT NULL, idvalue TEXT, idname TEXT, url TEXT, name TEXT, user_id INTEGER REFERENCES users(id), UNIQUE (showid, user_id) );

6. npm i
7. in index.js file change the line 10 (password: "pw", //change pw here) and type in your postgres pw
8. nodemon index.js
9. server is running on port 3000
