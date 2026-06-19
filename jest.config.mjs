export default {
  testEnvironment: "node",
  transform: {
    "^.+\.tsx?$": ["ts-jest", { useESM: false }],
  },
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
};