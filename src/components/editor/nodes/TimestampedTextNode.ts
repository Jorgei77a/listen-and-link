
import { TextNode, SerializedTextNode } from 'lexical';

export interface SerializedTimestampedTextNode extends SerializedTextNode {
  timestamp?: number;
}

export class TimestampedTextNode extends TextNode {
  __timestamp: number | undefined;

  static getType(): string {
    return 'timestamped-text';
  }

  static clone(node: TimestampedTextNode): TimestampedTextNode {
    return new TimestampedTextNode(node.__text, node.__timestamp, node.__key);
  }

  constructor(text: string, timestamp?: number, key?: string) {
    super(text, key);
    this.__timestamp = timestamp;
  }

  getTimestamp(): number | undefined {
    return this.__timestamp;
  }

  setTimestamp(timestamp: number | undefined): void {
    const self = this.getWritable();
    self.__timestamp = timestamp;
  }

  exportJSON(): SerializedTimestampedTextNode {
    return {
      ...super.exportJSON(),
      timestamp: this.__timestamp,
      type: 'timestamped-text',
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedTimestampedTextNode): TimestampedTextNode {
    const node = new TimestampedTextNode(
      serializedNode.text,
      serializedNode.timestamp
    );
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }
}

export function $createTimestampedTextNode(
  text: string,
  timestamp?: number
): TimestampedTextNode {
  return new TimestampedTextNode(text, timestamp);
}

export function $isTimestampedTextNode(
  node: any
): node is TimestampedTextNode {
  return node instanceof TimestampedTextNode;
}
