import { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
  Image,
  FlatList,
  PanResponder,
} from "react-native";
import * as Haptics from "expo-haptics";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, useThemeMode } from "../_layout";
import { ui, spacing, typography, radii } from "../../theme/tokens";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ONBOARDING_KEY = "medmap_onboarding_done";
const SLIDE_ICON = require("../../assets/icon.png");
const SLIDE_IMAGES = {
  2: require("../../assets/wallet_black.png"),
  3: require("../../assets/send_money.png"),
  4: require("../../assets/agreement.png"),
};
const ICON_SIZE = 120;
const IMAGE_SIZE = Math.min(SCREEN_WIDTH - 48, 280);

// Glass card (credit-card aspect, larger)
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 24, 460);
const CARD_HEIGHT = Math.round(CARD_WIDTH * 0.62);

const SLIDES = [
  {
    id: "1",
    title: "Find care providers near you",
    description: "Discover nearby doctors, pharmacies, and hospitals in seconds.",
  },
  {
    id: "2",
    title: "Filter for the care you need",
    description:
      "Use provider type, open-now, search, and distance (enable location for nearby results).",
  },
  {
    id: "3",
    title: "Call or chat instantly",
    description: "Connect with providers immediately, especially in urgent situations.",
  },
  {
    id: "4",
    title: "Pay securely with wallet support",
    description: "Pay for services and products, and manage your MedMap wallet in-app.",
  },
];

function GlassCardContent({ cardNumber, cardholder, expiry, theme }) {
  const isDark = theme.mode === "dark";
  const textColor = theme.text;
  const labelColor = theme.subtleText;
  const iconColor = theme.subtleText;
  return (
    <View style={styles.glassCardInner}>
      <View style={styles.glassCardTopRow}>
        <View style={styles.cardLogoWrap}>
          <Text style={[styles.cardLogoText, { color: textColor }]}>
            MedMap
          </Text>
        </View>
        <View style={styles.cardTopRight}>
          <Ionicons name="radio-outline" size={24} color={iconColor} />
        </View>
      </View>
      <View style={[styles.chip, styles.chipGold, styles.chipFloating]} />
      <Text style={[styles.glassCardNumber, { color: textColor }]}>
        {cardNumber}
      </Text>
      <View style={styles.glassCardBottomRow}>
        <View>
          <Text style={[styles.glassCardLabel, { color: labelColor }]}>
            CARDHOLDER
          </Text>
          <Text
            style={[styles.glassCardValue, { color: textColor }]}
            numberOfLines={1}
          >
            {cardholder}
          </Text>
        </View>
        <View style={styles.glassCardExpiryWrap}>
          <Text style={[styles.glassCardLabel, { color: labelColor }]}>
            EXPIRES
          </Text>
          <Text style={[styles.glassCardValue, { color: textColor }]}>
            {expiry}
          </Text>
        </View>
      </View>
    </View>
  );
}

const CARD_CENTER_LEFT = SCREEN_WIDTH / 2 - CARD_WIDTH / 2;
const CARD_CENTER_TOP = SCREEN_HEIGHT / 2 - CARD_HEIGHT / 1;
const BOTTOM_SECTION_RATIO = 0.42;

const SHIMMER_WIDTH = 36;
const SHIMMER_ANGLE = "-22deg";
const SHIMMER_DURATION_MS = 10000;

function FloatingGlassCards({
  opacity,
  scale,
  translateY,
  theme,
  slideIndex,
  currentIndex,
}) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const touchScale = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentIndex !== slideIndex) {
      Animated.parallel([
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          friction: 6,
          tension: 120,
        }),
        Animated.spring(touchScale, {
          toValue: 1,
          useNativeDriver: false,
          friction: 6,
          tension: 120,
        }),
      ]).start();
    }
  }, [currentIndex, slideIndex, pan, touchScale]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2200,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: SHIMMER_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SHIMMER_WIDTH - CARD_WIDTH, CARD_WIDTH + SHIMMER_WIDTH],
  });

  const springBack = () => {
    Animated.parallel([
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: false,
        friction: 4,
        tension: 180,
        velocity: 6,
      }),
      Animated.spring(touchScale, {
        toValue: 1,
        useNativeDriver: false,
        friction: 3,
        tension: 300,
      }),
    ]).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Animated.spring(touchScale, {
          toValue: 1.05,
          useNativeDriver: false,
          friction: 3,
          tension: 300,
        }).start();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        springBack();
      },
      onPanResponderTerminate: () => {
        springBack();
      },
    }),
  ).current;

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8],
  });

  const isDark = theme.mode === "dark";
  const glassStyle = {
    backgroundColor: isDark
      ? "rgba(255,255,255,0.08)"
      : "rgba(255,255,255,0.18)",
    borderColor: isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb",
  };

  return (
    <Animated.View
      style={[
        styles.floatingCardsWrap,
        {
          opacity,
          transform: [{ scale }, { translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          styles.floatingCardWrap,
          {
            left: CARD_CENTER_LEFT,
            top: CARD_CENTER_TOP,
            transform: [{ translateY: floatY }],
          },
        ]}
      >
        <Animated.View
          style={{
            width: CARD_WIDTH,
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
          }}
          {...panResponder.panHandlers}
        >
          <Animated.View style={{ transform: [{ scale: touchScale }] }}>
            <View style={[styles.glassCard, glassStyle]}>
              <Animated.View
                style={[
                  styles.glassShimmer,
                  {
                    transform: [
                      { rotate: SHIMMER_ANGLE },
                      { translateX: shimmerTranslateX },
                    ],
                  },
                ]}
                pointerEvents="none"
              />
              <GlassCardContent
                cardNumber="•••• •••• •••• 4242"
                cardholder="MedMap User"
                expiry="05/29"
                theme={theme}
              />
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

// Vertical offset so image area aligns with slide 1 card position
const CONTENT_OFFSET_UP = 64;

function AnimatedSlideImage({
  opacity,
  scale,
  translateY,
  slideIndex,
  currentIndex,
  source,
}) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const touchScale = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2600,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  useEffect(() => {
    if (currentIndex !== slideIndex) {
      Animated.parallel([
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          friction: 6,
          tension: 120,
        }),
        Animated.spring(touchScale, {
          toValue: 1,
          useNativeDriver: false,
          friction: 6,
          tension: 120,
        }),
      ]).start();
    }
  }, [currentIndex, slideIndex, pan, touchScale]);

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.03, 1],
  });

  const springBack = () => {
    Animated.parallel([
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: false,
        friction: 4,
        tension: 180,
        velocity: 6,
      }),
      Animated.spring(touchScale, {
        toValue: 1,
        useNativeDriver: false,
        friction: 3,
        tension: 300,
      }),
    ]).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Animated.spring(touchScale, {
          toValue: 1.08,
          useNativeDriver: false,
          friction: 3,
          tension: 300,
        }).start();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        springBack();
      },
      onPanResponderTerminate: () => {
        springBack();
      },
    }),
  ).current;

  return (
    <Animated.View
      style={[
        styles.walletSlideWrap,
        {
          opacity,
          transform: [{ scale }, { translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          styles.walletFloatWrap,
          {
            marginTop: -CONTENT_OFFSET_UP,
            transform: [{ translateY: floatY }],
          },
        ]}
      >
        <Animated.View
          style={{
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: Animated.multiply(touchScale, pulseScale) },
            ],
          }}
          {...panResponder.panHandlers}
        >
          <Image
            source={source}
            style={[
              styles.slideImage,
              { width: IMAGE_SIZE, height: IMAGE_SIZE * 1.1 },
            ]}
            resizeMode="contain"
          />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

function SlideItem({ item, index, scrollX, theme, currentIndex }) {
  const inputRange = [
    (index - 1) * SCREEN_WIDTH,
    index * SCREEN_WIDTH,
    (index + 1) * SCREEN_WIDTH,
  ];
  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.4, 1, 0.4],
    extrapolate: "clamp",
  });
  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.92, 1, 0.92],
    extrapolate: "clamp",
  });
  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [20, 0, 20],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      style={[
        styles.slide,
        {
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
          backgroundColor: "transparent",
        },
      ]}
    >
      <View style={styles.topSection}>
        <View style={styles.imageCenterWrap}>
          {item.id === "1" && (
            <FloatingGlassCards
              opacity={opacity}
              scale={scale}
              translateY={translateY}
              theme={theme}
              slideIndex={index}
              currentIndex={currentIndex}
            />
          )}
          {(item.id === "2" || item.id === "3" || item.id === "4") && (
            <AnimatedSlideImage
              opacity={opacity}
              scale={scale}
              translateY={translateY}
              slideIndex={index}
              currentIndex={currentIndex}
              source={SLIDE_IMAGES[item.id]}
            />
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { theme } = useThemeMode();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);

  const onSkip = () => {
    if (token) {
      router.replace("/(app)/home");
    } else {
      router.replace("/login");
    }
  };

  const goToLogin = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    router.replace("/login");
  };

  const goToRegister = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    router.replace("/register");
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems[0]) setCurrentIndex(viewableItems[0].index);
  }).current;
  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const renderSlide = ({ item, index }) => (
    <SlideItem
      item={item}
      index={index}
      scrollX={scrollX}
      theme={theme}
      currentIndex={currentIndex}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.topSectionWrap,
          { flex: 1, backgroundColor: theme.background },
        ]}
      >
        <Animated.FlatList
          ref={flatListRef}
          data={SLIDES}
          renderItem={renderSlide}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={[styles.list, { backgroundColor: "transparent" }]}
          contentContainerStyle={styles.listContent}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true },
          )}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      </View>

      <SafeAreaView
        style={[styles.safeHeader, { backgroundColor: "transparent" }]}
        edges={["top"]}
      >
        <View style={[styles.header, { backgroundColor: "transparent" }]}>
          <Text style={[styles.logo, { color: theme.text }]}>MEDMAP</Text>
          <TouchableOpacity
            onPress={onSkip}
            activeOpacity={0.7}
            style={[styles.skipBtn, { backgroundColor: theme.card }]}
          >
            <Text style={[ui.link(theme), styles.skipText]}>Skip</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View
        style={[
          styles.bottomSection,
          {
            backgroundColor: theme.background,
            minHeight: SCREEN_HEIGHT * BOTTOM_SECTION_RATIO,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
          },
        ]}
      >
        <View style={styles.paginationBar}>
          <View style={styles.dashes}>
            {SLIDES.map((_, i) => {
              const inputRange = [
                (i - 1) * SCREEN_WIDTH,
                i * SCREEN_WIDTH,
                (i + 1) * SCREEN_WIDTH,
              ];
              const activeOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0, 1, 0],
                extrapolate: "clamp",
              });
              const activeScaleX = scrollX.interpolate({
                inputRange,
                outputRange: [0.6, 1.2, 0.6],
                extrapolate: "clamp",
              });
              return (
                <View key={i} style={styles.dashTrack}>
                  <View
                    style={[
                      styles.dashBase,
                      { backgroundColor: theme.subtleText },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.dashActive,
                      {
                        backgroundColor: theme.primary,
                        opacity: activeOpacity,
                        transform: [{ scaleX: activeScaleX }],
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
        </View>
        <View style={styles.textSection}>
          <Text style={[ui.h1(theme), styles.slideTitle]} numberOfLines={2}>
            {SLIDES[currentIndex]?.title}
          </Text>
          <Text style={[ui.body(theme), styles.slideDesc]} numberOfLines={2}>
            {SLIDES[currentIndex]?.description}
          </Text>
        </View>
        <View style={styles.footer}>
          <View style={styles.authButtons}>
            <TouchableOpacity
              style={[ui.buttonPrimary(theme), styles.authBtn]}
              onPress={goToLogin}
              activeOpacity={0.85}
            >
              <Text style={ui.buttonTextPrimary(theme)}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ui.buttonOutline(theme), styles.authBtn]}
              onPress={goToRegister}
              activeOpacity={0.85}
            >
              <Text style={ui.buttonText(theme)}>Create account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topSectionWrap: {
    width: "100%",
  },
  safeHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  logo: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 18,
    letterSpacing: 0.3,
  },
  skipBtn: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },
  skipText: {
    fontSize: 15,
    fontFamily: typography.fontFamilyMedium,
  },
  list: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  listContent: {
    flexGrow: 0,
  },
  bottomSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    justifyContent: "space-between",
  },
  slide: {},
  topSection: {
    width: "100%",
    height: "90%",
    position: "relative",
  },
  imageCenterWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  shapeCenter: {
    justifyContent: "center",
    alignItems: "center",
  },
  slideIcon: {},
  walletSlideWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  walletFloatWrap: {
    justifyContent: "center",
    alignItems: "center",
  },
  walletImage: {
    borderRadius: radii.lg,
  },
  slideImage: {
    borderRadius: radii.lg,
  },
  floatingCardsWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  floatingCardWrap: {
    position: "absolute",
    width: CARD_WIDTH,
    zIndex: 10,
  },
  glassCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 6,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingVertical: 18,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  glassShimmer: {
    position: "absolute",
    top: -CARD_HEIGHT,
    left: 0,
    width: SHIMMER_WIDTH,
    height: CARD_HEIGHT * 3,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 2,
  },
  glassCardInner: {
    flex: 1,
    justifyContent: "space-between",
  },
  glassCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  cardLogoWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardLogoText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  cardTopRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    height: 64,
  },
  chip: {
    width: 50,
    height: 34,
    borderRadius: 5,
    borderWidth: 1,
    overflow: "hidden",
  },
  chipGold: {
    backgroundColor: "rgba(212,175,55,0.92)",
    borderColor: "rgba(255,235,180,0.7)",
  },
  chipFloating: {
    position: "absolute",
    left: 3,
    top: "40%",
    marginTop: -20,
  },
  glassCardNumber: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 18,
    color: "#ffffff",
    letterSpacing: 3,
    marginBottom: 16,
  },
  glassCardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  glassCardLabel: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 1,
    marginBottom: 2,
  },
  glassCardValue: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 12,
    color: "rgba(255,255,255,0.95)",
  },
  glassCardExpiryWrap: {
    alignItems: "flex-end",
  },
  glassCardName: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  glassCardDesc: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginTop: 4,
  },
  paginationBar: {
    width: "100%",
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  dashes: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 1,
  },
  dashTrack: {
    width: 18,
    height: 4,
    marginHorizontal: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    borderRadius: 999,
  },
  dashBase: {
    position: "absolute",
    width: "70%",
    height: 1,
    borderRadius: 999,
    opacity: 0.45,
  },
  dashActive: {
    position: "absolute",
    width: "80%",
    height: 2,
    borderRadius: 999,
  },
  textSection: {
    paddingVertical: spacing.lg,
    paddingHorizontal: 0,
  },
  textSlide: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  slideTitle: {
    marginBottom: spacing.sm,
    lineHeight: 32,
    maxWidth: "100%",
  },
  slideDesc: {
    opacity: 0.88,
    lineHeight: 22,
    fontSize: 15,
    fontFamily: typography.fontFamilyRegular,
    marginTop: 0,
  },
  footer: {
    paddingTop: spacing.xl,
    paddingBottom: 0,
  },
  authButtons: {
    gap: spacing.md,
  },
  authBtn: {
    width: "100%",
    minHeight: 52,
  },
});
