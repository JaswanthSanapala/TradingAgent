import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, BarChart3, Zap, Shield } from "lucide-react";

const features = [
  {
    title: "AI-Powered Trading Agents",
    description: "Create and train intelligent trading agents based on your strategies",
    icon: Brain,
    color: "text-blue-600"
  },
  {
    title: "Real-time Market Analysis",
    description: "Live charts with pattern recognition and technical indicators",
    icon: BarChart3,
    color: "text-green-600"
  },
  {
    title: "Automated Trading",
    description: "Execute trades automatically with integrated broker connections",
    icon: Zap,
    color: "text-purple-600"
  },
  {
    title: "Risk Management",
    description: "Advanced risk and money management as per your strategy",
    icon: Shield,
    color: "text-red-600"
  }
];

export default function FeaturesPage() {
  return (
    <div>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>Features</span>
          </CardTitle>
          <CardDescription>
            Explore the powerful features of the AI Trading Platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center space-x-4">
                  <feature.icon className={`h-8 w-8 ${feature.color}`} />
                  <div>
                    <CardTitle>{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-300">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
