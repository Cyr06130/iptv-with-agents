class Channel {
  final String id;
  final String name;
  final String group;
  final String? logoUrl;
  final String streamUrl;
  final bool isLive;

  const Channel({
    required this.id,
    required this.name,
    required this.group,
    this.logoUrl,
    required this.streamUrl,
    required this.isLive,
  });

  factory Channel.fromJson(Map<String, dynamic> json) {
    return Channel(
      id: json['id'] as String,
      name: json['name'] as String,
      group: json['group'] as String,
      logoUrl: json['logo_url'] as String?,
      streamUrl: json['stream_url'] as String,
      isLive: json['is_live'] as bool,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'group': group,
      'logo_url': logoUrl,
      'stream_url': streamUrl,
      'is_live': isLive,
    };
  }
}
