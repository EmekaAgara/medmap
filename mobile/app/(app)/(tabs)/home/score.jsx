import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { apiRequest } from "../../../../lib/api";
import { useThemeMode } from "../../../_layout";
import { ui, spacing } from "../../../../theme/tokens";

export default function CreditScoreScreen() {
  const [score, setScore] = useState(null);
  const [error, setError] = useState("");
  const { theme } = useThemeMode();

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest("/credit/score", { method: "GET" });
        setScore(res.data);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  return (
    <View style={ui.screen(theme)}>
      <Text style={[ui.h2(theme), styles.title]}>Credit score</Text>
      {error ? (
        <Text style={[ui.errorText(theme), styles.errorTop]}>{error}</Text>
      ) : null}
      {score ? (
        <View style={[ui.card(theme), styles.cardTop]}>
          <Text
            style={[ui.h1(theme), styles.scoreValue, { color: theme.primary }]}
          >
            {score.score}
          </Text>
          <Text style={[ui.body(theme), styles.labelTop]}>
            {score.riskRating}
          </Text>
        </View>
      ) : !error ? (
        <Text style={ui.caption(theme)}>Loading...</Text>
      ) : null}
    </View>
  );
}

const styles = {
  title: { marginBottom: spacing.sm },
  errorTop: { marginTop: spacing.sm },
  cardTop: { marginTop: spacing.lg },
  scoreValue: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  labelTop: { marginTop: spacing.xs },
};
