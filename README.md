# Pokédle

- Versions
  - [V1.0.0](https://github.com/maxm33/pokedle?tab=readme-ov-file#v100)
  - [V1.1.0](https://github.com/maxm33/pokedle?tab=readme-ov-file#v110)
- [Usage](https://github.com/maxm33/pokedle?tab=readme-ov-file#usage)

## V1.0.0

This is a web application for Web Application Development course.<br>

Pokédle is a game inspired by Wordle and LoLdle.<br>
The goal of this game is to guess a secret pokémon.<br>

All pokémons are represented by features such as habitat where they live, their colors, types and evolutions.<br>
After each guess made, you will be given hints on each of these categories relative to the secret pokémon.<br>
Hints will help you figure out what is the secret pokémon by looking at their colors:<br>

- `green` is an exact match on that same category of the secret pokémon;<br>
- `yellow` is a partial match (meaning there are multiple values and one of them is correct);<br>
- `red` means there's no match at all.<br>

> [!TIP]
> If you want to keep track of your game stats, make sure to login with Google.<br>

Secret pokémon changes every **5 minutes**.<br>

Have fun guessin' 'em all!<br><br>

Visit Pokédle [here](https://pokedle.onrender.com/).<br>

> [!NOTE]
> Pokédle can take 50 seconds or more to respond because the hosting site shuts down its service after 15 minutes of inactivity.

<br>

## V1.1.0

A new minor update has been implemented:<br>

- the server-side has been granted the admin privileges to his Firestore Cloud Storage access through the `Firebase Admin SDK` module,
  allowing a strong, simple and secure implementation of the `Firebase Security Rules`;<br>

- the `API endpoints' structure` has been reorganized to create a more intuitive hierarchical order;<br>

- `possibly-sensible data` has been moved to the hosting site using environment variables and secret files;<br>

- other small changes have been made to the EJS views, the CSS and the client's code to adapt to the server-side changes.

<br>

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
