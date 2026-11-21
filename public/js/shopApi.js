export async function fetchShopState(user) {
  const token = await user.getIdToken();
  return axios.get("/shop/state", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function performShopAction(user, { type, itemId, action }) {
  const token = await user.getIdToken();
  const headers = { Authorization: `Bearer ${token}` };

  if (type === "background") {
    if (action === "purchase") {
      await axios.post("/shop/purchase", { backgroundId: itemId }, { headers });
      return true;
    }

    await axios.patch(
      "/shop/equipped-background",
      { backgroundId: action === "unequip" ? null : itemId },
      { headers },
    );
    return false;
  }

  if (type === "boost") {
    if (action === "purchase") {
      await axios.post("/shop/boost/purchase", { itemId }, { headers });
      return true;
    }
    if (action === "activate")
      await axios.post("/shop/boost/activate", { itemId }, { headers });
    return false;
  }

  if (action === "purchase") {
    await axios.post(
      "/shop/collectibles/purchase",
      { type, itemId },
      { headers },
    );
    return true;
  }

  await axios.patch(
    "/shop/collectibles/equipped",
    { type, itemId: action === "unequip" ? null : itemId },
    { headers },
  );
  return false;
}
