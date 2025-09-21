# Pokédle

This is a web application for Web Application Development course.

<br>

## Index

- Version Changelog
  - [V1.0.0](#v100)
  - [V1.1.0](#v110)
  - [V1.5.6](#v156)
  - [V1.6.0](#v160)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Future Plans](#future-plans)

<br>

## V1.0.0

Pokédle is a game inspired by Wordle and LoLdle.<br>
The goal of this game is to guess a secret pokémon, which changes daily.<br>

All pokémons are represented by features such as habitat where they live, their colors, types and evolutions.<br>
After each guess made, you will be given hints on each of these categories relative to the secret pokémon.<br>
Hints will help you figure out what is the secret pokémon by looking at their colors:<br>

- `green` is an exact match on that same category of the secret pokémon;<br>
- `yellow` is a partial match (meaning there are multiple values and one of them is correct);<br>
- `red` means there's no match at all.<br>

<br>

> [!TIP]
> If you want to keep track of your game stats, make sure to login with Google.

<br>

Visit Pokédle [here](https://pokedle.onrender.com/) and have fun guessing 'em all!

<br>

## V1.1.0

A new minor update has been implemented:<br>

- the server-side has been granted the admin privileges to his Firestore Cloud Storage access through the `Firebase Admin SDK` module,
  allowing a strong, simple and secure implementation of the `Firebase Security Rules`;<br>

- `possibly-sensible data` has been moved to the hosting site using environment variables and secret files;<br>

- changed the CSS, EJS views and client's code to adapt to server-side changes.

<br>

## V1.5.6

Several minor updates have been implemented:<br>

- added `2nd, 3rd, 4th and 5th generation of pokémons`;<br>

- implemented the server-side verification of `Firebase ID Tokens` (based on JWT) for sensible requests, enhancing the security;<br>

- greatly improved `data consistency` both on client and server, improved the `rendering` of guesses;<br>

- the `API endpoints' structure` has been reorganized to create a more intuitive hierarchical order, improved server-side `error handling`;<br>

- renamed the only mode currently available to `classic mode` in prevision of new future game modes;<br>

- more `backgrounds` added for both PC and mobile resolutions, implemented a `background randomizer`;<br>

- changed the CSS, EJS views, static .webp assets and client's code.

<br>

## V1.6.0

A new minor update has been implemented:<br>

- reworked the `user interface` style;<br>

- the handling of `authentication` on client-side has been separated and modularized.

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

<br>

> [!NOTE]
> Locally, Pokédle is available at `localhost:3000`.

<br>

## Troubleshooting

If you are having trouble with the site (e.g. it looks broken), clearing the browser cache relative to this site is most likely the solution,
due to a unit conversion mistake that I recently made. Check [how to clear cache on Chrome](https://support.google.com/accounts/answer/32050?sjid=9309983268576311148-EU).

<br>

## Future Plans

New game modes and more stuff will be implemented in the near future, so stay tuned!

<br>
