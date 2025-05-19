
import { Card, CardContent } from "@/components/ui/card";

const Features = () => {
  const features = [
    {
      title: "Fast Transcription",
      description: "Convert audio to text quickly using OpenAI's powerful Whisper API",
      icon: "⚡"
    },
    {
      title: "Any File Size",
      description: "Handles large audio files by automatically splitting and processing in chunks",
      icon: "📦"
    },
    {
      title: "Easy Export",
      description: "Copy or download your transcript in seconds",
      icon: "💾"
    }
  ];

  return (
    <div className="container py-12">
      <h2 className="text-3xl font-bold text-center mb-12 gradient-text">
        Powerful Audio Transcription
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <Card key={index} className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="pt-6">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Features;
