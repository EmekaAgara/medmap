import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, TouchableOpacity } from "react-native";
import { useThemeMode } from "../_layout";
import { ui } from "../../theme/tokens";

export default function ScreenHeader({
  title,
  showBack = true,
  onBack,
  right = null,
  titleAlign = "center",
  left = null,
  compact = false,
  style = null,
}) {
  const router = useRouter();
  const { theme } = useThemeMode();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <View
      style={[
        ui.screenHeader(theme),
        compact ? { marginBottom: 0 } : null,
        style,
      ]}
    >
      {showBack ? (
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>
      ) : left ? (
        left
      ) : (
        <View style={styles.backPlaceholder} />
      )}
      <Text style={[ui.screenHeaderTitle(theme), { textAlign: titleAlign }]}>
        {title}
      </Text>
      {right ? right : <View style={styles.backPlaceholder} />}
    </View>
  );
}

const styles = {
  backButton: {
    marginLeft: 16,
    width: 32,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  backPlaceholder: {
    width: 32,
  },
};
