// verify the client's guess, generate related hints
function classicVerifyGuess(guess, answer) {
  const response = {
    habitat: "correct",
    colors: "correct",
    types: "correct",
    fullyEvolved: "correct",
    evolutionLevel: "correct",
    gen: "correct",
  };
  let count = 0;
  let hasWon = true;

  if (guess.name != answer.name) {
    hasWon = false;
    if (guess.habitat != answer.habitat) response.habitat = "wrong";
    if (guess.fullyEvolved != answer.fullyEvolved)
      response.fullyEvolved = "wrong";
    if (guess.evolutionLevel > answer.evolutionLevel)
      response.evolutionLevel = "wrong-lower";
    if (guess.evolutionLevel < answer.evolutionLevel)
      response.evolutionLevel = "wrong-higher";
    if (guess.gen > answer.gen) response.gen = "wrong-lower";
    if (guess.gen < answer.gen) response.gen = "wrong-higher";
    for (let i = 0; i < guess.types.length; i++)
      if (answer.types.includes(guess.types[i])) count++;
    if (count == 0) response.types = "wrong";
    else if (answer.types.length != count || guess.types.length != count)
      response.types = "partial";

    const getColorName = (color) => {
      let name;
      if (Array.isArray(color)) name = color[0];
      else if (color && typeof color === "object") name = color.name;
      else if (
        typeof color === "string" &&
        !/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)
      )
        name = color;

      return typeof name === "string" && name.trim()
        ? name.trim().toLowerCase()
        : null;
    };
    const guessColors = (guess.colors || []).map(getColorName);
    const answerColors = (answer.colors || []).map(getColorName);
    const remainingAnswerColors = new Map();
    for (const colorName of answerColors)
      if (colorName)
        remainingAnswerColors.set(
          colorName,
          (remainingAnswerColors.get(colorName) || 0) + 1,
        );
    let matchedColors = 0;
    for (const colorName of guessColors) {
      const remaining = colorName
        ? remainingAnswerColors.get(colorName) || 0
        : 0;
      if (remaining > 0) {
        matchedColors++;
        remainingAnswerColors.set(colorName, remaining - 1);
      }
    }

    if (
      guessColors.length === answerColors.length &&
      guessColors.every(Boolean) &&
      answerColors.every(Boolean) &&
      matchedColors === answerColors.length
    )
      response.colors = "correct";
    else if (matchedColors > 0) response.colors = "partial";
    else response.colors = "wrong";
  }
  return [guess, response, hasWon];
}

module.exports = classicVerifyGuess;
