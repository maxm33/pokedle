# Pokédle

This is a WebApp project for Sviluppo Applicazioni Web course (Web Application Development).

Pokédle is a game inspired by Wordle and LoLdle.<br>
The main goal of this game is to guess a secret pokémon.<br>

All pokémons are represented by some features such as habitat where they live, their colors, their types, their evolutions.<br>
You will be given hints on each of these categories for the pokémon you guess.<br>
These hints are represented by colors:
<code style="color : green">green</code> is an exact match on that same category of the secret pokémon, whereas <code style="color : gold">yellow</code> is a partial match (meaning that one value of the two is right). Lastly, <code style="color : red">red</code> means there's no match at all.<br>

If you want to keep track of your game stats, make sure to login with Google.

Pokémon to guess changes every **_3 minutes_**.

Have fun guessin' 'em all!<br><br>
Visit Pokédle [here](https://pokedle.onrender.com/).<br>
(Can be slow to load because the hosting site shuts the service down after 15 minutes of inactivity)

## Usage

- Install all the dependencies

```
npm install
```

- Start the app

```
npm start
```

**Note**: Server is listening on port 3000, so make sure to visit

```
localhost:3000
```

If port 3000 is occupied, you can change the port by editing its value in

> bin/www
