/**
 * ByteBuffer.js
 * 1，字节流基本类型封装
 * 2，long,int64类型实现
 * 3，utf8编码实现
 * 
 *  字节流打包:
 *  var buffer=new ByteBuffer(128);
 *  buffer.writeString("test string");
 *  buffer.writeHex(0x04);
 *  buffer.writeChar("|");
 *  buffer.writeUint32(1000);
    buffer.writeInt64(-14725836936900);
    socket.send(buffer.buffer,buffer.offset);

    字节流解包:
    var len=socket.read(data);
	
    var buffer=new ByteBuffer(len);
    buffer.setBufferData(data);
 *  var str=buffer.readString();
 *  var int32=buffer.readInt32();
 *  ....
 */

var ByteBuffer = function(length) {
	this.buffer = new ArrayBuffer(length);
	// this.byteStream=new Uint8Array(this.buffer);
	this.dataView = new DataView(this.buffer);
	// 缓冲区偏移量
	this.offset = 0;

	this.setBufferData = function(buffer) {
		this.buffer = buffer;
		this.dataView = new DataView(this.buffer);
		this.offset = 0;
		return this.dataView;
	}

	// copy buffer to another
	// buffer,m.appendArrayBuffer(m.offset+2,n.buffer,0,5);
	this.appendArrayBuffer = function(toPos, fromBuffer, fromPos, length) {
		// console.log("appendArrayBuffer toPos=%d,fromPos=%d,length=%d
		// \n",toPos,fromPos,length);

		var uarr = new Uint8Array(fromBuffer);
		for (var i = fromPos; i < length; i++) {
			this.dataView.setInt8(toPos++, uarr[i], true);
		}
	}

	// 将uarr复制到当前缓冲区
	this.appendUint8Array = function(toPos, uarr) {
		for (var i = 0; i < uarr.length; i++) {
			this.dataView.setInt8(toPos++, uarr[i], true);
		}
	}

	this.initHeader = function() {
		this.offset += 9;
	}

	this.setHeader = function(input) {
		this.dataView.setInt8(0, 0x7c, true);
		this.dataView.setUint32(1, input, true);
		this.dataView.setUint32(5, input - 5, true);
	}

	// writeChar("a")
	this.writeChar = function(input) {
		this.dataView.setInt8(this.offset++, input.charCodeAt(), true);
		return this.offset;
	}

	// writeHex(0x04);
	this.writeHex = function(input) {
		this.dataView.setInt8(this.offset++, input);
		return this.offset;
	}

	this.writeUint16 = function(input) {
		this.dataView.setUint16(this.offset, input, true);
		this.offset += 2;
		return this.offset;
	}

	this.writeUint32 = function(input) {
		this.dataView.setUint32(this.offset, input, true);
		this.offset += 4;
	}

	this.writeInt32 = function(input) {
		this.dataView.setInt32(this.offset, input, true);
		this.offset += 4;
	}

	this.writeInt64 = function(input) {
		var sign = input < 0;
		if (sign)
			input = -1 - input;
		for (var i = 0; i < 8; i++) {
			var mod = input % 0x100;
			input = (input - mod) / 0x100;
			var v = sign ? mod ^ 0xFF : mod;
			this.dataView.setUint8(this.offset++, v);
		}
		return this.offset;
	}

	this.readInt64 = function() {
		var bytes = new Uint8Array(this.buffer, this.offset, 8);
		var sign = bytes[7] >> 7;
		this.offset += 8;
		var sum = 0;
		var digits = 1;
		for (var i = 0; i < 8; i++) {
			var value = bytes[i];
			sum += (sign ? value ^ 0xFF : value) * digits;
			digits *= 0x100;
		}
		return sign ? -1 - sum : sum;
	}

	this.writeString = function(input) {
		var utf8Length = this.UTF8Length(input);
		this.offset = this.writeUint16(utf8Length);
		this.stringToUTF8(input);

		return this.offset;
	}

	// ======================

	this.readUint32 = function() {
		var ret = this.dataView.getUint32(this.offset, true);
		this.offset += 4;
		return ret;
	}

	this.readInt32 = function() {
		var ret = this.dataView.getInt32(this.offset, true);
		this.offset += 4;
		return ret;
	}

	this.readInt16 = function() {
		var ret = this.dataView.getInt16(this.offset, true);
		this.offset += 2;
		return ret;
	}

	this.readString = function() {
		var length = this.readInt16();
		var uint8Array = new Uint8Array(this.buffer, this.offset, length);
		var ret = this.parseUTF8(uint8Array, 0, uint8Array.length);
		this.offset += uint8Array.length;
		return ret;
	}

	this.readFloat32 = function() {
		var ret = this.dataView.getFloat32(this.offset, true);
		this.offset += 4;
		return ret;
	}

	this.readFloat64 = function() {
		var ret = this.dataView.getFloat64(this.offset, true);
		this.offset += 4;
		return ret;
	}

	this.readList = function(types) {
		if (types.length <= 0)
			return;
		var list = [];
		var length = this.readInt16();
		for (var row = 0; row < length; row++) {
			var values = {};
			for (var i = 0; i < types.length; i++) {
				var type = types[i];

				if (types[i] == "int") {
					values[type] = this.readInt32();
				} else if (types[i] == "short") {
					values[type] = this.readInt16();
				} else if (types[i] == "float") {
					values[type] = this.readFloat32();
				} else if (types[i] == "double") {
					values[type] = this.readFloat64();
				} else if (types[i] == "string") {
					values[type] = this.readString();
				}
			}
			list[row] = values;
		}
		return list;
	}

	this.stringToUTF8 = function(input) {
		for (var i = 0; i < input.length; i++) {
			var charCode = input.charCodeAt(i);

			// Check for a surrogate pair.
			if (0xD800 <= charCode && charCode <= 0xDBFF) {
				var lowCharCode = input.charCodeAt(++i);
				if (isNaN(lowCharCode)) {
					throw new Error(format(ERROR.MALFORMED_UNICODE, [ charCode,
							lowCharCode ]));
				}
				charCode = ((charCode - 0xD800) << 10) + (lowCharCode - 0xDC00)
						+ 0x10000;
			}

			if (charCode <= 0x7F) {
				this.writeHex(charCode);
			} else if (charCode <= 0x7FF) {
				this.writeHex(charCode >> 6 & 0x1F | 0xC0);
				this.writeHex(charCode & 0x3F | 0x80);
			} else if (charCode <= 0xFFFF) {
				this.writeHex(charCode >> 12 & 0x0F | 0xE0);
				this.writeHex(charCode >> 6 & 0x3F | 0x80);
				this.writeHex(charCode & 0x3F | 0x80);
			} else {
				this.writeHex(charCode >> 18 & 0x07 | 0xF0);
				this.writeHex(charCode >> 12 & 0x3F | 0x80);
				this.writeHex(charCode >> 6 & 0x3F | 0x80);
				this.writeHex(charCode & 0x3F | 0x80);
			}
			;
		}
		return this.byteStream;
	}

	this.UTF8Length = function(input) {
		var output = 0;
		for (var i = 0; i < input.length; i++) {
			var charCode = input.charCodeAt(i);
			if (charCode > 0x7FF) {
				// Surrogate pair means its a 4 byte character
				if (0xD800 <= charCode && charCode <= 0xDBFF) {
					i++;
					output++;
				}
				output += 3;
			} else if (charCode > 0x7F)
				output += 2;
			else
				output++;
		}
		return output;
	}

	this.parseUTF8 = function(input, offset, length) {
		var output = "";
		var utf16;
		var pos = offset;

		while (pos < offset + length) {
			var byte1 = input[pos++];
			if (byte1 < 128)
				utf16 = byte1;
			else {
				var byte2 = input[pos++] - 128;
				if (byte2 < 0)
					throw new Error(format(ERROR.MALFORMED_UTF, [
							byte1.toString(16), byte2.toString(16), "" ]));
				if (byte1 < 0xE0) // 2 byte character
					utf16 = 64 * (byte1 - 0xC0) + byte2;
				else {
					var byte3 = input[pos++] - 128;
					if (byte3 < 0)
						throw new Error(format(ERROR.MALFORMED_UTF, [
								byte1.toString(16), byte2.toString(16),
								byte3.toString(16) ]));
					if (byte1 < 0xF0) // 3 byte character
						utf16 = 4096 * (byte1 - 0xE0) + 64 * byte2 + byte3;
					else {
						var byte4 = input[pos++] - 128;
						if (byte4 < 0)
							throw new Error(format(ERROR.MALFORMED_UTF, [
									byte1.toString(16), byte2.toString(16),
									byte3.toString(16), byte4.toString(16) ]));
						if (byte1 < 0xF8) // 4 byte character
							utf16 = 262144 * (byte1 - 0xF0) + 4096 * byte2 + 64
									* byte3 + byte4;
						else
							// longer encodings are not supported
							throw new Error(format(ERROR.MALFORMED_UTF, [
									byte1.toString(16), byte2.toString(16),
									byte3.toString(16), byte4.toString(16) ]));
					}
				}
			}

			if (utf16 > 0xFFFF) // 4 byte character - express as a surrogate
			// pair
			{
				utf16 -= 0x10000;
				output += String.fromCharCode(0xD800 + (utf16 >> 10)); // lead
				// character
				utf16 = 0xDC00 + (utf16 & 0x3FF); // trail character
			}
			output += String.fromCharCode(utf16);
		}
		return output;
	}

	this.encode = function(bytes) {
		for (var i = 0; i < bytes.length; i++) {
			bytes[i] ^= 0xFF;
		}
		return bytes;
	}
}
