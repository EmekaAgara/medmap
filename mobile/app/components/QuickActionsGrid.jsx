import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii, typography } from '../../theme/tokens';
import { hapticTap } from '../../src/utils/haptics';

/**
 * actions: [{ key, label, icon, onPress, color? }]
 * Renders a 4×N grid (looks consistent on Home/Profile).
 */
export default function QuickActionsGrid({ actions, theme }) {
  const list = Array.isArray(actions) ? actions.filter(Boolean) : [];
  return (
    <View style={styles.row}>
      {list.map((action) => (
        <TouchableOpacity
          key={action.key}
          style={[styles.btn, { borderColor: theme.border, backgroundColor: theme.card }]}
          onPress={() => {
            hapticTap();
            action.onPress?.();
          }}
          activeOpacity={0.9}
        >
          <View style={[styles.iconWrap, { backgroundColor: theme.secondary }]}>
            <Ionicons name={action.icon} size={20} color={action.color || theme.primary} />
          </View>
          <Text style={[styles.label, { color: theme.subtleText }]} numberOfLines={2}>
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = {
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  btn: {
    width: '23%',
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 11,
    textAlign: 'center',
  },
};

