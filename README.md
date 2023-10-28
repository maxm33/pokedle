# Pokédle

This is a WebApp project for Sviluppo Applicazioni Web course (Web Application Development).<br>

Pokédle is a game inspired by Wordle and LoLdle.<br>
The main goal of this game is to guess a secret pokémon.<br>

All pokémons are represented by features such as habitat where they live, their colors, their types, their evolutions.<br>
You will be given hints on each of these categories for the pokémon you guess.<br>
Through their colors, these hints will help you to figure out what is the secret pokemon:<br>

- `green` is an exact match on that same category of the secret pokémon;<br>
- `yellow` is a partial match (meaning that one value of the two is right);<br>
- `red` means there's no match at all.<br>

If you want to keep track of your game stats, make sure to login with Google.<br>

Secret pokémon changes every **_5 minutes_**.<br>

Have fun guessin' 'em all!<br><br>
Visit Pokédle [here](https://pokedle.onrender.com/).<br>
(Can be slow to load because the hosting site shuts the service down after 15 minutes of inactivity)<br>

## Usage

- Install all the dependencies

```
npm install
```

- Start the app

```
npm start
```

**Note**: Locally, server is available at `localhost:3000` (you can change port value in `bin/www`).<br>
