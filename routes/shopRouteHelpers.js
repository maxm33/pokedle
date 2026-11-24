async function runShopTransaction({
  firestore,
  userId,
  res,
  next,
  createError,
  updateUser,
}) {
  try {
    const userRef = firestore.collection("users").doc(userId);
    const result = await firestore.runTransaction((transaction) =>
      updateUser(transaction, userRef),
    );
    if (result.error)
      return res.status(result.status).send({ error: result.error });
    return res.status(200).send(result);
  } catch (error) {
    console.error(error);
    return next(createError(500));
  }
}

async function runVerifiedShopTransaction({
  req,
  res,
  next,
  verifyShopUserToken,
  firestore,
  createError,
  updateUser,
}) {
  const decodedToken = await verifyShopUserToken(req, res);
  if (!decodedToken) return;
  return runShopTransaction({
    firestore,
    userId: decodedToken.uid,
    res,
    next,
    createError,
    updateUser,
  });
}

function createVerifiedShopMutationRunner({
  verifyShopUserToken,
  firestore,
  createError,
}) {
  return (req, res, next, prepareUserUpdate) =>
    runVerifiedShopTransaction({
      req,
      res,
      next,
      verifyShopUserToken,
      firestore,
      createError,
      updateUser: async (transaction, userRef) => {
        const doc = await transaction.get(userRef);
        const user = doc.data();
        if (!user) return { error: "User not found", status: 404 };
        return prepareUserUpdate(transaction, userRef, user);
      },
    });
}

module.exports = { createVerifiedShopMutationRunner };
