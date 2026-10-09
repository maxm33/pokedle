# Pokédle

In the project's early stages, this was a web application for Web Application Development course. Sometimes, I do extend it as ideas come to the mind and free time is available.

<br>

## Index

- Version Changelog
  - [V1.0.0](#v100)
  - [V1.1.0](#v110)
  - [V1.5.6](#v156)
  - [V1.6.0](#v160)
  - [V1.7.1](#v171)
  - [V1.8.0](#v180)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)

<br>

## V1.0.0

Pokédle is a game inspired by Wordle and LoLdle.<br>
The goal of this game is to guess a secret pokémon, which changes daily.<br>

All pokémons are represented by features such as `habitat` where they live, their `colors`, `types`, `evolution stages` and `generations`.<br>
Based on each guess made, you will be given `colored hints` on each of these categories in relation to the secret pokémon ones.<br>
Such hints will help you figure out what is the secret pokémon by looking at their colors:<br>

- `green` is an `exact match` on that same category of the secret pokémon;<br>
- `yellow` is a `partial match` (meaning there are multiple values and one of them is correct);<br>
- `red` means there's `no match` at all.<br>

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

## V1.7.1

A new minor update has been implemented:<br>

- added new mode `Sentry Duty`, based on the PMD2 mini-game;

- added new logo image and new gameboy-like pokémon font.

<br>

## V1.8.0

A new minor update has been implemented:<br>

- added `shiny pokémons`;

- restyled the `pokédex` view;

- reworked visuals of the old `guess button`, from now it is referred to as the `ball button`;

- added a few new game-like animations to the `ball button`;

- added `daily-consecutive win-streaks` for logged-in players with incremental upgrades to the `ball tier` of the `ball button` (pokeball -> great ball -> ultra ball -> master ball -> reset);

- each `ball tier` has an increasing chance of capturing a shiny version of the daily pokémon;

- added customizable `usernames` for logged-in players;

- added medals to third, second and first places in `rankings` pages;

- added randomic trigger of `events`, as of right now there is just a `legendary-only event`.

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

> [!NOTE]
> Firebase/Firestore API interactions are not available on localhost, unless you build your own storage and choose to abilitate it to do so.

<br>

## Troubleshooting

If you are having trouble with the site (e.g. it looks broken), clearing the browser cache relative to this site is most likely the solution. Check [how to clear cache on Chrome](https://support.google.com/accounts/answer/32050?sjid=9309983268576311148-EU).

<br>
