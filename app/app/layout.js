export const metadata = {
  title: "Team Legend Sales System",
  description: "Team Legend shop management and sales system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Arial, sans-serif",
          backgroundColor: "#f5f7fa",
        }}
      >
        {children}
      </body>
    </html>
  );
}
