# ByteBuffer.js
javascript字节流网络包封装类

1，字节流基本类型封装
2，long,int64类型实现
3，utf8编码实现

字节流打包:
var buffer=new ByteBuffer(128);
buffer.writeString("test string");
buffer.writeHex(0x04);
buffer.writeChar("|");
buffer.writeUint32(1000);
buffer.writeInt64(-14725836936900);
socket.send(buffer.buffer,buffer.offset);

字节流解包:
var len=socket.read(data);
var buffer=new ByteBuffer(len);
buffer.setBufferData(data);
var str=buffer.readString();
var int32=buffer.readInt32();
