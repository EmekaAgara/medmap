import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useThemeMode } from "../../_layout";
import { typography } from "../../../theme/tokens";

const tabHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

const TAB_ICONS = {
  Home: { active: "home", inactive: "home-outline" },
  Explore: { active: "map", inactive: "map-outline" },
  Messages: { active: "chatbubble", inactive: "chatbubble-outline" },
  Profile: { active: "person-circle", inactive: "person-circle-outline" },
};

function TabIcon({ label, color, focused }) {
  const icons = TAB_ICONS[label];
  return (
    <View style={{ marginBottom: 2 }}>
      <Ionicons
        name={focused ? icons.active : icons.inactive}
        size={20}
        color={color}
      />
    </View>
  );
}

function TabBarLabel({ label, color }) {
  return (
    <Text
      style={{
        fontSize: 9,
        color,
        fontFamily: typography.fontFamilyMedium,
        marginBottom: 10,
      }}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const { theme } = useThemeMode();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          height: 80,
          paddingBottom: 18,
          paddingTop: 8,
        },
        tabBarItemStyle: {
          paddingBottom: 8,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.subtleText,
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon label="Home" color={color} focused={focused} />
          ),
          tabBarLabel: ({ color }) => (
            <TabBarLabel label="Home" color={color} />
          ),
        }}
        listeners={{ tabPress: tabHaptic }}
      />
      <Tabs.Screen
        name="explore/index"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon label="Explore" color={color} focused={focused} />
          ),
          tabBarLabel: ({ color }) => (
            <TabBarLabel label="Explore" color={color} />
          ),
        }}
        listeners={{ tabPress: tabHaptic }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon label="Messages" color={color} focused={focused} />
          ),
          tabBarLabel: ({ color }) => (
            <TabBarLabel label="Messages" color={color} />
          ),
        }}
        listeners={{ tabPress: tabHaptic }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon label="Profile" color={color} focused={focused} />
          ),
          tabBarLabel: ({ color }) => (
            <TabBarLabel label="Profile" color={color} />
          ),
        }}
        listeners={{ tabPress: tabHaptic }}
      />
      {/* Non-tab routes — hidden from the tab bar */}
      <Tabs.Screen name="home/score" options={{ href: null }} />
      <Tabs.Screen name="home/urgent" options={{ href: null }} />
      <Tabs.Screen name="notifications/index" options={{ href: null }} />
    </Tabs>
  );
}
