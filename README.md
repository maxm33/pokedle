# Pokédle

This is a web application for Web Application Development course.<br>

Pokédle is a game inspired by Wordle and LoLdle.<br>
The goal of this game is to guess a secret pokémon.<br>

All pokémons are represented by features such as habitat where they live, their colors, types and evolutions.<br>
After each guess made, you will be given hints on each of these categories relative to the secret pokémon.<br>
Hints will help you figure out what is the secret pokemon by looking at their colors:<br>

- `green` is an exact match on that same category of the secret pokémon;<br>
- `yellow` is a partial match (meaning there are multiple values and one of them is correct);<br>
- `red` means there's no match at all.<br>

> [!TIP]
> If you want to keep track of your game stats, make sure to login with Google.<br>

Secret pokémon changes every **5 minutes**.<br>

Have fun guessin' 'em all!<br><br><br><br>

Visit Pokédle [here](https://pokedle.onrender.com/).<br>

> [!NOTE]
> Pokédle can be slow to load because the host server shuts down after 15 minutes of inactivity.

## Usage

- Install all the dependencies

```
npm install
```

- Start the app

```
npm start
```

> [!NOTE]
> Locally, Pokédle is available at `localhost:3000`.
