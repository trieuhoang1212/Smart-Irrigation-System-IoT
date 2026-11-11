
import { View, Text, StyleSheet } from 'react-native';

export default function ExploreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Smart Irrigation</Text>
      <Text style={styles.subtitle}>
        Khu vực quản lý và theo dõi hệ thống tưới cây.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8F5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#173D2A',
  },
  subtitle: {
    fontSize: 14,
    color: '#78877D',
    marginTop: 10,
    textAlign: 'center',
  },
});
