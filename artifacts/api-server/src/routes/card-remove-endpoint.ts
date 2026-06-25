// Add this to /api/card-clash/admin/card/remove in card-clash.ts routes
// This endpoint removes a card from inventory

router.post("/admin/card/remove", async (req, res) => {
  const adminPin = req.headers["x-admin-pin"];
  if (adminPin !== process.env.ADMIN_PIN || adminPin !== "0601") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { playerId, cardId, quantity = 1 } = req.body;

  if (!playerId || !cardId) {
    return res.status(400).json({ error: "Missing playerId or cardId" });
  }

  try {
    const existing = await db.query.cardInventory.findFirst({
      where: and(
        eq(cardInventoryTable.playerId, playerId),
        eq(cardInventoryTable.cardId, cardId)
      ),
    });

    if (!existing) {
      return res.status(404).json({ error: "Card not found in inventory" });
    }

    const newQuantity = (existing.quantity || 1) - quantity;

    if (newQuantity <= 0) {
      // Remove card entirely if quantity drops to 0
      await db
        .delete(cardInventoryTable)
        .where(and(eq(cardInventoryTable.playerId, playerId), eq(cardInventoryTable.cardId, cardId)));
    } else {
      // Update quantity
      await db
        .update(cardInventoryTable)
        .set({ quantity: newQuantity })
        .where(and(eq(cardInventoryTable.playerId, playerId), eq(cardInventoryTable.cardId, cardId)));
    }

    // Award coins for selling
    const coinsEarned = 10 * quantity;
    await db
      .update(playerTable)
      .set({ cardPoints: playerTable.cardPoints + coinsEarned })
      .where(eq(playerTable.id, playerId));

    res.json({ success: true, coinsEarned });
  } catch (error) {
    console.error("Error removing card:", error);
    res.status(500).json({ error: "Failed to remove card" });
  }
});
